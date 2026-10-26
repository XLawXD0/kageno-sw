'use strict';

import fs from 'fs';
import path from 'path';
import pino from 'pino';
import readline from 'node:readline';

import JSONDB from './src/db/json.js';
import { createBotClient } from './src/zapo-client.js';
import { injectClient } from './helper/inject.js';
import { setMainConn, setMainConnecting, isMainConnecting } from './helper/main-conn.js';
import { readSwConfig } from './helper/swconfig.js';
import { telegram } from './helper/index.js';
import { storyTick } from './helper/schedstory.js';

export const sessionDir = path.join(process.cwd(), 'sessions', process.env.BOT_SESSION_NAME || 'kageno');

const logger = pino({ level: process.env.BOT_LOGGER_LEVEL || 'silent' }).child({ class: 'Bot Utama' });
const delay = ms => new Promise(r => setTimeout(r, ms));

let reconnectCount = 0;

// ===== Pairing interaktif lewat konsol =====
// Saat bot belum pairing, konsol langsung MENANYAKAN nomor WA untuk
// disambungkan dengan kode pairing (satu-satunya cara sambung).
// Pilihan & nomor disimpan di state ini agar reconnect tidak bertanya ulang.
const pairState = { mode: 'pending', number: '', prompted: false, done: false };
let _rl = null;
let _rlClosed = false;
function getRl() {
	if (!_rl) {
		_rl = readline.createInterface({ input: process.stdin, output: process.stdout });
		_rl.on('close', () => { _rlClosed = true; });
	}
	return _rl;
}
function askLine(question) {
	return new Promise(resolve => {
		if (_rlClosed || !process.stdin.readable) return resolve(null);
		const rl = getRl();
		let settled = false;
		const finish = v => {
			if (settled) return;
			settled = true;
			rl.removeListener('close', onClose);
			resolve(v);
		};
		const onClose = () => finish(null);
		rl.once('close', onClose);
		try {
			rl.question(question, ans => finish(ans));
		} catch { finish(null); }
	});
}

/** Minta kode pairing dengan retry — koneksi zapo butuh beberapa detik
 *  sebelum siap; sekali panggil langsung sering gagal "client is not connected". */
async function requestPairingWithRetry(hisoka, number) {
	for (let attempt = 1; attempt <= 5; attempt++) {
		if (pairState.done || hisoka._pairingAborted || hisoka.authState.creds?.registered) return 'ok';
		try {
			const code = await hisoka.requestPairingCode(number, 'SC4RLXRD');
			const formatted = code?.match(/.{1,4}/g)?.join('-') || code;
			console.log(`\n\x1b[32mKode Pairing kamu: ${formatted}\x1b[39m`);
			console.log('Buka WhatsApp di HP nomor itu -> Perangkat Tertaut -> Tautkan dengan nomor telepon -> masukkan kode di atas.\n');
			return 'ok';
		} catch (err) {
			const msg = String(err?.message || err);
			console.log(`[pairing] percobaan ${attempt}/5 gagal: ${msg}`);
			// 429 = WhatsApp membatasi permintaan kode (terlalu banyak percobaan).
			// WAJIB berhenti: makin sering dicoba, makin lama hukumannya.
			if (/429|rate-overlimit|rate.?limit/i.test(msg)) {
				console.error('\x1b[31mWhatsApp membatasi permintaan kode pairing (429 rate-overlimit).\x1b[39m');
				console.error('Berhenti meminta kode dulu — tunggu sekitar 1 jam, lalu restart bot untuk mencoba pairing lagi.');
				return 'rate';
			}
			if (attempt === 5) {
				console.error('\x1b[31mGagal meminta kode pairing setelah 5 percobaan.\x1b[39m');
				console.error('Screenshot baris-baris "[pairing] percobaan ..." di atas, kirim ke Rem untuk ditelusuri.');
				return 'fail';
			}
			await delay(10000);
		}
	}
}

/** Minta nomor WA di konsol & jalankan pairing kode (satu-satunya cara). */
async function pairingPrompt(hisoka) {
	console.log('\n==================================================');
	console.log('Bot belum terhubung ke WhatsApp.');
	console.log('Sambungkan dengan KODE PAIRING: masukkan nomor WA');
	console.log('yang mau dijadikan bot — kode pairing dikirim ke nomor itu.');
	console.log('Lewati pertanyaan ini: atur BOT_NUMBER_PAIR di settings.js.');
	console.log('==================================================');
	// Tanya terus sampai dapat nomor valid & pairing berhasil. stdin
	// tertutup (panel tanpa input) -> jangan keluar: beri jeda lalu tanya
	// lagi; user bisa menjawab lewat tab "App input" atau mengatur
	// BOT_NUMBER_PAIR di settings.js lalu restart.
	const deadline = Date.now() + 30 * 60 * 1000;
	while (Date.now() < deadline) {
		const ans = await askLine('Masukkan nomor WA yang mau dijadikan bot (format 628xxxxxxxxxx): ');
		if (ans === null) {
			console.log('[pairing] menunggu nomor... (jawab lewat "App input", atau atur BOT_NUMBER_PAIR di settings.js lalu restart)');
			await delay(60000);
			continue;
		}
		const num = String(ans).replace(/[^0-9]/g, '');
		if (num.length >= 9 && num.length <= 15) {
			pairState.number = num;
			pairState.mode = 'pair';
			const res = await requestPairingWithRetry(hisoka, num);
			if (res === 'ok' || res === 'rate') return;
			console.log('[pairing] pairing belum berhasil — silakan coba lagi.');
			await delay(5000);
			continue;
		}
		console.log('Nomornya tidak valid — pakai format 628xxxxxxxxxx (tanpa +, spasi, atau strip).');
	}
	console.log('[pairing] belum ada nomor yang dimasukkan. Atur BOT_NUMBER_PAIR di settings.js lalu restart untuk menyambungkan.');
}


/**
 * Kirim ringkasan status harian ke Telegram owner (forward saja).
 */
async function sendDailySummary(hisoka) {
	const chatId = process.env.TELEGRAM_OWNER_ID || process.env.TELEGRAM_CHAT_ID;
	const token = process.env.TELEGRAM_TOKEN;
	if (!token || !chatId) return;
	const entries = hisoka.statusLog?.read('entries') || [];
	if (!entries.length) return;

	let text = `📊 Ringkasan status hari ini (${entries.length} status)\n\n`;
	for (const e of entries) {
		const jam = new Date(e.time).toLocaleTimeString('id-ID', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit' });
		const cap = e.caption || (e.hasMedia ? '[media]' : '-');
		text += `• ${e.name} (${jam}): ${cap}\n`;
	}

	try {
		await telegram.send(chatId, text, { type: 'text', token });
		hisoka.statusLog.write('entries', []);
		console.info('\x1b[32mRingkasan status harian terkirim.\x1b[39m');
	} catch (err) {
		console.error('\x1b[31mGagal mengirim ringkasan status harian:\x1b[39m', err?.message || err);
	}
}

function scheduleDailySummary(hisoka) {
	const scheduleNext = () => {
		const now = new Date();
		const wibNow = new Date(now.getTime() + (7 * 60 + now.getTimezoneOffset()) * 60000);
		const target = new Date(wibNow);
		target.setHours(23, 59, 0, 0);
		if (target <= wibNow) target.setDate(target.getDate() + 1);
		const delayMs = Math.max(target.getTime() - wibNow.getTime(), 1000);

		setTimeout(async () => {
			await sendDailySummary(hisoka);
			scheduleNext();
		}, delayMs);
	};
	scheduleNext();
}

/**
 * Koneksikan WA utama. Pairing lewat konsol:
 * - BOT_NUMBER_PAIR terisi di settings.js -> langsung kode pairing.
 * - Kosong -> konsol langsung menanyakan nomor WA.
 */
export async function connectMainWA() {
	if (isMainConnecting()) {
		console.log('[main-wa] sudah dalam proses koneksi, abaikan.');
		return null;
	}
	setMainConnecting(true);
	console.log(`\x1b[36mStarting with session directory: ${sessionDir}\x1b[39m`);

	if (reconnectCount > 0) {
		console.warn(`\x1b[33mReconnecting... Attempt ${reconnectCount}\x1b[39m`);
	}

	const cacheMsg = new Map();
	const groups = new JSONDB('groups', sessionDir);
	const contacts = new JSONDB('contacts', sessionDir);
	const settings = new JSONDB('settings', sessionDir);
	const statusLog = new JSONDB('statuslog', sessionDir);

	const raw = createBotClient({ sessionDir, logger });
	const hisoka = injectClient(raw, cacheMsg, contacts, groups, settings);
	hisoka.statusLog = statusLog;
	hisoka._dataDir = null; // bot utama pakai cwd

	const alreadyPaired = !!hisoka.authState.creds?.registered;

	// Nomor dari settings.js (BOT_NUMBER_PAIR) tetap didukung: langsung
	// mode pairing tanpa bertanya. Kosong -> tanya nomor di konsol.
	const envPairNumber = String(process.env.BOT_NUMBER_PAIR || '').replace(/[^0-9]/g, '');
	if (envPairNumber && !pairState.number) {
		pairState.number = envPairNumber;
		pairState.mode = 'pair';
	}

	if (!alreadyPaired) {
		if (pairState.mode === 'pair' && pairState.number) {
			requestPairingWithRetry(hisoka, pairState.number).catch(() => {});
		} else if (!pairState.prompted) {
			pairState.prompted = true;
			pairingPrompt(hisoka).catch(() => {});
		}
	}

	hisoka.ev.on('connection.update', async ({ connection, lastDisconnect, qr }) => {

		if (connection === 'open') {
			pairState.done = true;
			reconnectCount = 0;
			setMainConnecting(false);
			setMainConn(hisoka);
			console.log(`\x1b[32mConnected successfully! ${JSON.stringify(hisoka.user, null, 2)}\x1b[39m`);

			// Auto-restore jadibot clones (in-process)
			try {
				const { restoreAllJadibots } = await import('./helper/jadibot.js');
				const restored = await restoreAllJadibots(hisoka);
				if (restored.length) console.log(`\x1b[32m[jadibot] ${restored.length} clone direstore: ${restored.join(', ')}\x1b[39m`);
			} catch (err) {
				console.error('[jadibot] restore gagal:', err?.message);
			}

			// Bio WA otomatis
			if (!hisoka._uptimeBioTimer) {
				const uptimeBioTick = async () => {
					try {
						const sw = readSwConfig(hisoka);
						if (!sw.uptimebio) return;
						const s = Math.floor(process.uptime());
						const h = Math.floor(s / 3600);
						const mnt = Math.floor((s % 3600) / 60);
						const up = h > 0 ? `${h}j ${mnt}m` : `${mnt}m`;
						await hisoka.updateProfileStatus(`🟢 KAGENO • Online ⏱️ ${up}`);
					} catch (err) {
						console.error('\x1b[31mGagal update bio uptime:\x1b[39m', err?.message || err);
					}
				};
				uptimeBioTick();
				hisoka._uptimeBioTimer = setInterval(uptimeBioTick, 60 * 1000);

				// Penjadwal auto-posting story
				if (!hisoka._storyTimer) {
					hisoka._storyTimer = setInterval(() => {
						storyTick(hisoka).catch(e => console.error('\x1b[31m[story] tick error:\x1b[39m', e?.message || e));
					}, 60 * 1000);
				}
			}

			// Fetch privacy settings
			try {
				console.info('\x1b[36mFetching privacy settings...\x1b[39m');
				const privacySettings = await hisoka.fetchPrivacySettings();
				settings.write('privacy', privacySettings);
			} catch (err) {
				console.error('[privacy] gagal ambil:', err?.message || err);
			}

			// Load semua command (dari plugin)
			try {
				console.info('\x1b[36mLoading command handlers...\x1b[39m');
				const { loadPlugins } = await import('./plugins/_loader.js');
				const { map: pluginMap } = await loadPlugins(path.join(process.cwd(), 'plugins'));
				hisoka.loadedCommands = [...pluginMap.keys()];
				console.info(`\x1b[32mLoaded ${hisoka.loadedCommands.length} command handlers.\x1b[39m`);
			} catch (err) {
				console.error('[plugin] gagal load:', err?.message || err);
			}

			scheduleDailySummary(hisoka);
		}

		if (connection === 'close') {
			hisoka._pairingAborted = true;
			const statusCode = lastDisconnect?.error?.output?.statusCode || 0;

			if (statusCode === 401) {
				// Logout / forbidden: sesi tidak valid lagi — bersihkan & keluar.
				setMainConn(null);
				setMainConnecting(false);
				console.error('\x1b[31mSession expired or logged out. Please re-authenticate.\x1b[39m');
				try { await hisoka.end(); } catch {}
				try {
					const dirContents = await fs.promises.readdir(sessionDir);
					for (const file of dirContents) {
						if (file.startsWith('.env')) continue;
						await fs.promises.rm(path.join(sessionDir, file), { recursive: true, force: true });
					}
				} catch {}
				process.exit(1);
			}

			if (statusCode === 515) {
				console.info('\x1b[33mRestart required. Reconnecting...\x1b[39m');
				setMainConnecting(false);
				try { await hisoka.end(); } catch {}
				await connectMainWA();
				return;
			}

			if (Number(process.env.BOT_MAX_RETRIES) && reconnectCount >= Number(process.env.BOT_MAX_RETRIES)) {
				console.error(`\x1b[31mMax retries reached (${process.env.BOT_MAX_RETRIES}). Exiting...\x1b[39m`);
				process.exit(1);
			}
			console.error(`\x1b[31mConnection closed unexpectedly. Reconnecting in ${Math.min(5 * reconnectCount, 30)} seconds...\x1b[39m`);
			reconnectCount++;
			try { await hisoka.end(); } catch {}
			await delay(Math.min(5 * reconnectCount, 30) * 1000);
			setMainConnecting(false);
			connectMainWA();
		}
	});

	// Isi cache grup dari adapter (adapter mengambil metadata semua grup saat open)
	hisoka.ev.on('groups.upsert', async groupsData => {
		await Promise.all(
			(groupsData || []).map(group => {
				const existingGroup = groups.read(group.id) || {};
				return groups.write(group.id, { ...existingGroup, ...group });
			})
		);
	});
	hisoka.ev.on('groups.update', async groupsData => {
		await Promise.all(
			(groupsData || []).map(group => {
				const existingGroup = groups.read(group.id) || {};
				return groups.write(group.id, { ...existingGroup, ...group });
			})
		);
	});
	hisoka.ev.on('group-participants.update', ({ id, participants, action }) => {
		const existingGroup = groups.read(id) || {};
		if (!existingGroup.participants) return;
		if (action === 'add') {
			existingGroup.participants = [...existingGroup.participants, ...participants.map(jid => ({ id: jid }))];
		} else if (action === 'remove') {
			existingGroup.participants = existingGroup.participants.filter(p => !participants.includes(p.phoneNumber || p.id));
		}
		groups.write(id, existingGroup);
	});

	// DEBUG RVO
	if (process.env.DEBUG_RVO === 'true') {
		hisoka.ev.on('messages.update', updates => {
			for (const u of updates) {
				const mk = Object.keys(u.update?.message || {}).join(',');
				console.log(`[rvo-DBG update] keys: ${mk || '(none)'}`);
			}
		});
		hisoka.ev.on('messages.upsert', ({ messages, type }) => {
			for (const msg of messages) {
				const keys = Object.keys(msg.message || {}).join(',');
				const hasVO = JSON.stringify(msg.message || {}).includes('viewOnce');
				const stub = msg.messageStubType ? ` stub=${msg.messageStubType}` : '';
				console.log(`[rvo-DBG upsert] type=${type} fromMe=${msg.key?.fromMe} hasVO=${hasVO}${stub} keys=${keys}`);
			}
		});
	}

	hisoka.ev.on('messages.upsert', async messagesUpsert => {
		for (const message of messagesUpsert.messages) {
			if (message.key && message.message) {
				if (!hisoka.cacheMsg.has(message.key.id)) {
					hisoka.cacheMsg.set(message.key.id, message);
				}
			}
			const messageHandler = await import('./handler/message.js');
			await messageHandler.default({ ...messagesUpsert, message }, hisoka);
		}
	});

	return hisoka;
}

// ===== BOOT: langsung konek WhatsApp (pairing via konsol bila belum) =====
export async function boot() {
	try {
		const paired = fs.existsSync(path.join(sessionDir, 'zapo-paired.json'));
		if (paired) console.log('[boot] sesi WA ditemukan — auto-connect...');
		else console.log('[boot] belum pairing — ikuti pilihan menyambungkan di konsol.');
		await connectMainWA();
	} catch (err) {
		console.error('[boot] error:', err?.message || err);
		setMainConnecting(false);
	}
}

// Graceful shutdown
for (const sig of ['SIGTERM', 'SIGINT']) {
	process.on(sig, async () => {
		console.log(`\n[${sig}] graceful shutdown...`);
		try {
			const { stopJadibot } = await import('./helper/jadibot.js');
			const keys = Object.keys(global.jadibots || {});
			for (const k of keys) {
				await stopJadibot(k, { removeSession: false }).catch(() => {});
			}
		} catch {}
		try {
			const { sessionManager } = await import('./helper/session-manager.js');
			await sessionManager.shutdown();
		} catch {}
		process.exit(0);
	});
}
