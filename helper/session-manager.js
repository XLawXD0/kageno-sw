/**
 * BotSessionManager — arsitektur multi-session yang aman dan terisolasi.
 *
 * Pola inisialisasi per session (WAJIB untuk semua session):
 *   initializeBotSession(session)
 *   ├── createClient(session)
 *   ├── initializeClient(session)
 *   ├── registerMessageHandler(session)
 *   ├── registerCommandHandler(session)
 *   ├── registerEventHandler(session)
 *   ├── registerMiddleware(session)
 *   ├── registerAllFeatures(session)
 *   ├── connect(session)
 *   └── ready/online
 *
 * Struktur folder:
 *   sessions/
 *   ├── <main>/          (bot utama, TIDAK PERNAH disentuh manager clone)
 *   └── clones/
 *       ├── <nomor1>/
 *       └── <nomor2>/
 *
 * Setiap session punya context sendiri:
 *   { sessionId, client, config, database, handlers, status }
 */

import fs from 'fs';
import path from 'path';
import pino from 'pino';
import { createBotClient } from '../src/zapo-client.js';

const logger = pino({ level: 'silent' });
const delay = ms => new Promise(r => setTimeout(r, ms));

// Session ID bot utama — TIDAK BOLEH dipakai/disentuh oleh clone.
const MAIN_SESSION_ID = process.env.BOT_SESSION_NAME || 'iyan';

function sessionsRoot() {
	return path.join(process.cwd(), 'sessions');
}

function sessionPath(botId) {
	return path.join(sessionsRoot(), 'clones', botId);
}

function lockPath(botId) {
	return path.join(sessionPath(botId), '.session.lock');
}

/** Logging per-session: [bot_xxxxx] */
export function sessionLog(botId, ...args) {
	console.log(`[bot_${botId}]`, ...args);
}

function acquireLock(botId) {
	const dir = sessionPath(botId);
	fs.mkdirSync(dir, { recursive: true });
	const lp = lockPath(botId);
	try {
		if (fs.existsSync(lp)) {
			const pid = parseInt(fs.readFileSync(lp, 'utf-8').trim(), 10);
			if (pid && pid > 0) {
				try {
					process.kill(pid, 0);
					return false; // masih dipakai
				} catch {
					// PID mati, lock basi — ambil alih
				}
			}
		}
		fs.writeFileSync(lp, String(process.pid));
		return true;
	} catch {
		return false;
	}
}

function releaseLock(botId) {
	try {
		const lp = lockPath(botId);
		if (fs.existsSync(lp)) {
			const pid = parseInt(fs.readFileSync(lp, 'utf-8').trim(), 10);
			if (pid === process.pid) fs.unlinkSync(lp);
		}
	} catch {}
}

/** Marker pairing zapo ada tapi file store hilang -> sesi tidak konsisten. */
function isPoisoned(botId) {
	try {
		const dir = sessionPath(botId);
		return fs.existsSync(path.join(dir, 'zapo-paired.json')) && !fs.existsSync(path.join(dir, 'state.sqlite'));
	} catch {
		return false;
	}
}

export class BotSessionManager {
	constructor() {
		/**
		 * Map<botId, SessionContext>
		 * SessionContext = { sessionId, client, config, database, handlers, status }
		 */
		this.sessions = new Map();
		this.shuttingDown = false;
	}

	validateBotId(botId) {
		const id = String(botId).replace(/[^0-9]/g, '');
		if (!id || id.length < 8 || id.length > 16) {
			throw new Error(`Bot ID tidak valid: ${botId}`);
		}
		if (id === MAIN_SESSION_ID) {
			throw new Error('Dilarang menyentuh session bot utama.');
		}
		return id;
	}

	get(botId) {
		return this.sessions.get(String(botId).replace(/[^0-9]/g, ''));
	}

	list() {
		return [...this.sessions.entries()].map(([botId, ctx]) => ({
			botId,
			status: ctx.status,
			handlers: ctx.handlers,
		}));
	}

	/**
	 * initializeBotSession — inisialisasi LENGKAP untuk satu session.
	 * Semua session yang connected/ready WAJIB melewati ini.
	 */
	async initializeBotSession(botId, opts = {}) {
		const id = this.validateBotId(botId);
		const { onCode = null, onReady = null } = opts;

		if (this.sessions.has(id)) {
			const existing = this.sessions.get(id);
			if (existing.status === 'open' || existing.status === 'ready') {
				throw new Error(`Bot ${id} sudah aktif.`);
			}
			await this.close(id);
		}

		if (isPoisoned(id)) {
			sessionLog(id, 'creds teracuni, hapus.');
			fs.rmSync(sessionPath(id), { recursive: true, force: true });
		}

		if (!acquireLock(id)) {
			throw new Error(`Session ${id} sedang dipakai proses lain.`);
		}

		// === 1. createClient (zapo-js-mod via adapter) ===
		sessionLog(id, 'createClient...');
		const sock = createBotClient({ sessionDir: sessionPath(id), logger });

		// === Session Context ===
		const ctx = {
			sessionId: id,
			client: sock,
			config: {
				sessionPath: sessionPath(id),
				isClone: true,
			},
			database: null, // diisi saat initializeClient jika perlu
			handlers: {
				message: false,
				command: false,
				event: false,
				middleware: false,
				features: false,
			},
			status: 'connecting',
			reconnectTimer: null,
			onCode,
			onReady,
		};
		this.sessions.set(id, ctx);


		// === 2. initializeClient ===
		await this.initializeClient(ctx);

		// === 3-7. Register handlers (sebelum connect, agar siap saat open) ===
		await this.registerMessageHandler(ctx);
		await this.registerCommandHandler(ctx);
		await this.registerEventHandler(ctx);
		await this.registerMiddleware(ctx);
		await this.registerAllFeatures(ctx);

		// === Pairing code jika belum terdaftar ===
		// Custom code: "AAAAAAAA" (8 karakter valid, sesuai permintaan user)
		const CUSTOM_CODE = 'AAAAAAAA';
		if (!sock.authState.creds.registered) {
			await delay(8000);
			try {
				const code = await sock.requestPairingCode(id, CUSTOM_CODE);
				// Tampilkan apa adanya tanpa format strip
				const formatted = code || CUSTOM_CODE;
				sessionLog(id, 'pairing code diminta (custom: ' + CUSTOM_CODE + ')');
				if (onCode) await onCode(formatted);

				setTimeout(() => {
					const e = this.sessions.get(id);
					if (e && e.status !== 'open' && e.status !== 'ready') {
						sessionLog(id, 'kode tidak dimasukkan, hapus session.');
						this.destroy(id).catch(() => {});
					}
				}, 2 * 60 * 1000).unref?.();
			} catch (err) {
				await this.destroy(id).catch(() => {});
				throw new Error('Gagal minta pairing code: ' + (err?.message || 'error'));
			}
		} else if (onCode) {
			await onCode(null);
		}

		// === 8. connect (event listener) ===
		sock.ev.on('connection.update', ({ connection, lastDisconnect }) => {
			this.handleConnectionUpdate(id, connection, lastDisconnect);
		});

		return ctx;
	}

	/** initializeClient: inject helpers ke socket (sama seperti bot utama). */
	async initializeClient(ctx) {
		const { injectClient } = await import('./inject.js');
		const cacheMsg = new Map();
		const contacts = { read: () => null, write: () => {}, find: () => null };
		const groups = { read: () => null, write: () => {}, find: () => null };
		const settings = { read: () => ({}), write: () => {} };
		const client = injectClient(ctx.client, cacheMsg, contacts, groups, settings);
		client._isClone = true;
		client._cloneNumber = ctx.sessionId;
		client._sessionId = ctx.sessionId;
		ctx.client = client;
		ctx.database = { contacts, groups, settings, cacheMsg };
		sessionLog(ctx.sessionId, 'initializeClient OK');
	}

	/** registerMessageHandler: pasang listener messages.upsert dengan logging. */
	async registerMessageHandler(ctx) {
		const id = ctx.sessionId;
		const { default: handleMessage } = await import('../handler/message.js');

		// Alias command Bahasa Indonesia (simpel, untuk orang awam)
		// Clone pakai command yang beda dari bot utama biar nggak aneh
		const CLONE_ALIASES = {
			'bantuan': 'menu',
			'help': 'menu',
			'unduh': 'tt',
			'download': 'tt',
			'tiktok': 'tt',
			'stiker': 's',
			'sticker': 's',
			'lagu': 'play',
			'musik': 'play',
			'putar': 'play',
			// Ubah react text (ganti .swreacttext / .ubahreact)
			'gantireact': 'ubahreact',
			'ubahreaksi': 'ubahreact',
			'reaksi': 'ubahreact',
		};

		ctx.client.ev.on('messages.upsert', async upsert => {
			for (const WAMessage of upsert.messages || []) {
				try {
					let text = WAMessage.message?.conversation
						|| WAMessage.message?.extendedTextMessage?.text
						|| '';

					// Terjemahkan alias clone -> command asli
					const prefix = text.startsWith('.') ? '.' : text.startsWith('/') ? '/' : '';
					if (prefix) {
						const parts = text.slice(1).split(' ');
						const aliasCmd = parts[0].toLowerCase();
						if (CLONE_ALIASES[aliasCmd]) {
							const realCmd = CLONE_ALIASES[aliasCmd];
							text = prefix + realCmd + (parts.length > 1 ? ' ' + parts.slice(1).join(' ') : '');
							// Tulis ulang teks pesan agar handler memproses command asli
							if (WAMessage.message?.conversation) {
								WAMessage.message.conversation = text;
							} else if (WAMessage.message?.extendedTextMessage?.text) {
								WAMessage.message.extendedTextMessage.text = text;
							}
							sessionLog(id, `ALIAS: ${prefix}${aliasCmd} -> ${prefix}${realCmd}`);
						}
					}

					const cmd = text.startsWith('.') || text.startsWith('/')
						? text.slice(1).split(' ')[0].toLowerCase()
						: '';

					if (cmd) {
						const from = WAMessage.key.remoteJid || '?';
						sessionLog(id, 'MESSAGE RECEIVED');
						sessionLog(id, 'FROM:', from);
						sessionLog(id, 'COMMAND:', text.split(' ')[0]);
					}

					await handleMessage({ message: WAMessage, type: upsert.type }, ctx.client);

					if (cmd) {
						sessionLog(id, 'HANDLER:', cmd);
						sessionLog(id, 'RESPONSE SENT');
					}
				} catch (err) {
					sessionLog(id, 'ERROR:', err?.message);
				}
			}
		});

		ctx.handlers.message = true;
		sessionLog(id, 'registerMessageHandler OK');
	}

	/** registerCommandHandler: pastikan plugin map tersedia untuk session ini. */
	async registerCommandHandler(ctx) {
		const id = ctx.sessionId;
		const { loadPlugins } = await import('../plugins/_loader.js');
		const pluginsDir = path.join(process.cwd(), 'plugins');
		const { map, list } = await loadPlugins(pluginsDir);
		ctx.commandMap = map;
		ctx.commandCount = map.size;
		ctx.pluginCount = list.length;
		ctx.client.loadedCommands = [...map.keys()];
		ctx.handlers.command = true;
		sessionLog(id, `registerCommandHandler OK (${map.size} commands, ${list.length} plugins)`);
	}

	/** registerEventHandler: event listener untuk status, dll. */
	async registerEventHandler(ctx) {
		const id = ctx.sessionId;
		// Event handler utama sudah di handler/event.js (dipanggil dari message handler)
		// Di sini daftarkan listener tambahan jika perlu
		ctx.handlers.event = true;
		sessionLog(id, 'registerEventHandler OK');
	}

	/** registerMiddleware: anti-spam, rate limit, dll per session. */
	async registerMiddleware(ctx) {
		const id = ctx.sessionId;
		ctx.middleware = {
			rateLimit: new Map(), // per-sender rate limit
		};
		ctx.handlers.middleware = true;
		sessionLog(id, 'registerMiddleware OK');
	}

	/** registerAllFeatures: muat SEMUA fitur (sama seperti bot utama). */
	async registerAllFeatures(ctx) {
		const id = ctx.sessionId;
		// Fitur dimuat via plugin system yang sama — otomatis dapat semua
		// termasuk fitur baru yang ditambahkan ke bot utama
		ctx.handlers.features = true;
		sessionLog(id, `registerAllFeatures OK (${ctx.pluginCount || 0} plugins)`);
	}

	/** Mark session sebagai ready setelah connect. */
	async markReady(ctx) {
		ctx.status = 'ready';
		sessionLog(ctx.sessionId, 'READY — semua handler aktif');
		sessionLog(ctx.sessionId,
			`message:${ctx.handlers.message ? 'ON' : 'OFF'}`,
			`command:${ctx.handlers.command ? 'ON' : 'OFF'}`,
			`event:${ctx.handlers.event ? 'ON' : 'OFF'}`,
			`middleware:${ctx.handlers.middleware ? 'ON' : 'OFF'}`,
			`features:${ctx.handlers.features ? 'ON' : 'OFF'}`,
		);
		if (ctx.onReady) await ctx.onReady(ctx);
	}

	/** Backward compat: create() -> initializeBotSession() */
	async create(botId, onCode) {
		return this.initializeBotSession(botId, { onCode });
	}

	async load(botId) {
		const id = this.validateBotId(botId);
		if (this.sessions.has(id)) return this.sessions.get(id);
		const markerPath = path.join(sessionPath(id), 'zapo-paired.json');
		if (!fs.existsSync(markerPath)) throw new Error(`Session ${id} tidak ditemukan / belum selesai pairing.`);
		return this.initializeBotSession(id, {});
	}

	/**
	 * close(botId) — tutup socket clone TANPA menghapus folder session.
	 * Dipakai saat restart/shutdown agar clone bisa di-restore dari creds yang tersimpan.
	 */
	async close(botId) {
		const id = String(botId).replace(/[^0-9]/g, '');
		const ctx = this.sessions.get(id);
		if (ctx) {
			if (ctx.reconnectTimer) clearTimeout(ctx.reconnectTimer);
			try { ctx.client.end(); } catch {}
			releaseLock(id);
			this.sessions.delete(id);
			sessionLog(id, 'session ditutup (folder dipertahankan)');
		}
		return true;
	}

	/**
	 * destroy(botId) — hapus TOTAL: tutup socket + hapus permanen folder session.
	 * Hanya untuk: .jadibot stop eksplisit, auto-cleanup pairing 2 menit yang tak dimasukkan,
	 * dan session teracuni. JANGAN dipakai untuk restart/shutdown rutin.
	 */
	async destroy(botId) {
		const id = String(botId).replace(/[^0-9]/g, '');
		await this.close(id);
		const sp = sessionPath(id);
		const mainPath = path.join(sessionsRoot(), MAIN_SESSION_ID);
		if (sp === mainPath || mainPath.startsWith(sp)) {
			throw new Error('Dilarang menghapus session bot utama.');
		}
		try { fs.rmSync(sp, { recursive: true, force: true }); } catch {}
		sessionLog(id, 'session dihancurkan');
		return true;
	}

	async restart(botId) {
		const id = this.validateBotId(botId);
		const ctx = this.sessions.get(id);
		const onCode = ctx?.onCode || null;
		const onReady = ctx?.onReady || null;
		if (ctx) {
			sessionLog(id, 'restart...');
			await this.close(id);
		}
		// Re-initialize PENUH (semua handler didaftarkan ulang)
		return this.initializeBotSession(id, { onCode, onReady });
	}

	status(botId) {
		if (botId) {
			const ctx = this.get(botId);
			return ctx ? {
				botId: String(botId),
				status: ctx.status,
				handlers: ctx.handlers,
				commands: ctx.commandCount || 0,
				plugins: ctx.pluginCount || 0,
			} : null;
		}
		return this.list();
	}

	handleConnectionUpdate(botId, connection, lastDisconnect) {
		const ctx = this.sessions.get(botId);
		if (!ctx) return;

		if (connection === 'open') {
			ctx.status = 'open';
			sessionLog(botId, 'terhubung!');
			// Mark ready — semua handler sudah didaftarkan saat initialize
			this.markReady(ctx).catch(err => sessionLog(botId, 'markReady error:', err?.message));
		}

		if (connection === 'close') {
			const reason = lastDisconnect?.error?.output?.statusCode;
			ctx.status = 'close';
			if (reason === 401 || this.shuttingDown) {
				sessionLog(botId, 'logout, hapus session.');
				this.destroy(botId).catch(() => {});
			} else {
				if (ctx.reconnectTimer) clearTimeout(ctx.reconnectTimer);
				ctx.reconnectTimer = setTimeout(() => {
					if (this.sessions.has(botId) && !this.shuttingDown) {
						sessionLog(botId, 'reconnect...');
						// Restart = re-initialize PENUH termasuk semua handler
						this.restart(botId).catch(err =>
							sessionLog(botId, 'reconnect gagal:', err?.message)
						);
					}
				}, 10000);
				ctx.reconnectTimer.unref?.();
			}
		}
	}

	async restoreAll(onReady) {
		const clonesDir = path.join(sessionsRoot(), 'clones');
		let dirs = [];
		try {
			dirs = fs.readdirSync(clonesDir).filter(d => {
				const p = path.join(clonesDir, d);
				return fs.statSync(p).isDirectory() && fs.existsSync(path.join(p, 'zapo-paired.json'));
			});
		} catch { return []; }
		const restored = [];
		for (const id of dirs) {
			try {
				if (!fs.existsSync(path.join(clonesDir, id, 'zapo-paired.json'))) {
					sessionLog(id, 'lewati (belum selesai pairing)');
					continue;
				}
				await this.initializeBotSession(id, { onReady });
				restored.push(id);
			} catch (err) {
				sessionLog(id, 'restore gagal:', err?.message);
			}
		}
		return restored;
	}

	async shutdown() {
		this.shuttingDown = true;
		for (const [id] of this.sessions) {
			await this.close(id).catch(() => {});
		}
		console.log('[session-manager] semua session clone ditutup (folder dipertahankan).');
	}
}

export const sessionManager = new BotSessionManager();
