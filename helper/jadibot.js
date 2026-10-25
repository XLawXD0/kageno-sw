'use strict';
// Inti sistem jadibot (in-process). Clone jalan di dalam proses bot utama,
// jadi tidak butuh proses pm2 terpisah.

import fs from 'fs';
import path from 'path';
import { jidNormalizedUser } from '../src/compat.js';
import { createBotClient } from '../src/zapo-client.js';
import pino from 'pino';

import JSONDB from '../src/db/json.js';
import { injectClient } from './inject.js';
import { isCloneCtx } from './paths.js';

if (!global.jadibots) global.jadibots = {};

const cleanNum = n => String(n).replace(/[^0-9]/g, '');
const logger = pino({ level: 'silent' });


/** Path folder session jadibot berdasarkan nomor target. */
export function jadibotSessionDir(targetNumber) {
	const id = cleanNum(targetNumber);
	return path.join(process.cwd(), 'sessions', 'clones', id);
}

// ---- Kredit durasi: sisa waktu berbayar yang tersimpan saat clone ter-logout ----
// Disimpan di data/jadibot-credits.json agar awet walau session dihapus / bot restart.
// Key: `${ownerJid}|${targetNumber}` → sisa ms.
function creditsFile() {
	return path.join(process.cwd(), 'data', 'jadibot-credits.json');
}
function loadCredits() {
	try {
		const f = creditsFile();
		if (!fs.existsSync(f)) return {};
		return JSON.parse(fs.readFileSync(f, 'utf-8')) || {};
	} catch { return {}; }
}
function saveCredits(c) {
	try {
		fs.mkdirSync(path.dirname(creditsFile()), { recursive: true });
		fs.writeFileSync(creditsFile(), JSON.stringify(c, null, 1));
	} catch (e) { console.error('[jadibot] gagal simpan credits:', e?.message || e); }
}
/** Sisa kredit durasi (ms) untuk pasangan owner+nomor. 0 bila tidak ada. */
export function getDurationCredit(ownerJid, targetNumber) {
	const c = loadCredits();
	const v = c[`${ownerJid}|${cleanNum(targetNumber)}`];
	return (typeof v === 'number' && v > 0) ? v : 0;
}
/** Simpan/timpa kredit durasi. ms <= 0 menghapus entri. */
export function saveDurationCredit(ownerJid, targetNumber, ms) {
	const c = loadCredits();
	const k = `${ownerJid}|${cleanNum(targetNumber)}`;
	if (ms > 0) c[k] = Math.floor(ms);
	else delete c[k];
	saveCredits(c);
}
/** Ambil + hapus kredit durasi (sekali pakai saat reconnect). */
export function consumeDurationCredit(ownerJid, targetNumber) {
	const ms = getDurationCredit(ownerJid, targetNumber);
	if (ms > 0) saveDurationCredit(ownerJid, targetNumber, 0);
	return ms;
}

/** List semua jadibot aktif. */
export function listJadibots() {
	return Object.entries(global.jadibots).map(([key, ctx]) => {
		let currentRemaining = ctx.remainingDurationMs;
		if (ctx.status === 'open' && ctx.durationTimeout && ctx.lastConnectedTimestamp) {
			const elapsed = Date.now() - ctx.lastConnectedTimestamp;
			currentRemaining = Math.max(0, ctx.remainingDurationMs - elapsed);
		}
		return {
			ownerJid: ctx.ownerJid,
			botJid: ctx.sock?.user?.id || null,
			botName: ctx.sock?.user?.name || null,
			status: ctx.status || 'unknown',
			startedAt: ctx.startedAt,
			connectedAt: ctx.connectedAt,
			durationLimitMs: ctx.durationLimitMs,
			remainingDurationMs: currentRemaining,
			targetNumber: ctx.targetNumber,
			expiredAt: ctx.expiredAt || null,
			graceRemainingMs: ctx.status === 'expired' && ctx.expiredAt
				? Math.max(0, GRACE_PERIOD_MS - (Date.now() - ctx.expiredAt))
				: null,
		};
	});
}

export function fmtDuration(ms) {
	if (!ms || ms < 0) return '0 detik';
	const s = Math.floor(ms / 1000);
	if (s < 60) return `${s} detik`;
	const m = Math.floor(s / 60);
	if (m < 60) return `${m} menit`;
	const h = Math.floor(m / 60);
	if (h < 24) return `${h} jam ${m % 60} menit`;
	return `${Math.floor(h / 24)} hari ${h % 24} jam`;
}

/** Masa tenggang session setelah durasi habis: 1 hari. */
export const GRACE_PERIOD_MS = 24 * 60 * 60 * 1000;

export function fmtGraceRemaining(ctx) {
	if (!ctx?.expiredAt) return null;
	const remain = GRACE_PERIOD_MS - (Date.now() - ctx.expiredAt);
	return remain > 0 ? fmtDuration(remain) : '0 detik';
}

/**
 * Kirim notifikasi ke owner jadibot via WhatsApp dan/atau Telegram.
 * Dipakai agar jadibot yang dibuat dari Telegram juga dapat notifikasi di Telegram.
 */
export async function notifyJadibotOwner(ctx, conn, text, { quoted } = {}) {
	const jobs = [];
	const notifyJid = ctx?.notifyJid;
	if (notifyJid && conn) {
		jobs.push(conn.sendMessage(notifyJid, { text }, quoted ? { quoted } : {}).catch(() => {}));
	}
	const ntg = ctx?.notifyTg;
	if (ntg?.chatId && ntg?.token) {
		jobs.push((async () => {
			const { telegram } = await import('./index.js');
			const tgText = String(text)
				.replace(/\*([^*]+)\*/g, '<b>$1</b>')
				.replace(/_([^_]+)_/g, '<i>$1</i>');
			await telegram.send(ntg.chatId, tgText, { type: 'text', token: ntg.token, parse_mode: 'HTML' });
		})().catch(e => console.error('[notify-tg] gagal:', e?.message || e)));
	}
	await Promise.all(jobs);
}

export function parseDuration(str) {
	if (!str) return 0;
	const match = String(str).trim().match(/^(\d+)([smhd])?$/i);
	if (!match) return parseInt(str) * 60 * 1000;
	const num = parseInt(match[1]);
	const unit = (match[2] || 'm').toLowerCase();
	switch (unit) {
		case 's': return num * 1000;
		case 'm': return num * 60 * 1000;
		case 'h': return num * 60 * 60 * 1000;
		case 'd': return num * 24 * 60 * 60 * 1000;
		default: return num * 60 * 1000;
	}
}

// Batas aman setTimeout Node.js (2^31-1 ms ≈ 24,8 hari).
// Durasi lebih lama dipecah jadi beberapa tahap agar tidak overflow
// (overflow = timer langsung meledak seketika!).
const MAX_TIMER_MS = 2147483647;

export function startDurationTimer(ctx, conn, notifyJid) {
	if (!ctx.remainingDurationMs || ctx.remainingDurationMs <= 0) {
		// Durasi pernah diatur tapi sudah lewat (mis. restore setelah deadline) → expire
		if (ctx.durationLimitMs > 0 && ctx.status === 'open') {
			console.log(`[jadibot ${ctx.targetNumber}] deadline sudah lewat saat connect — expire.`);
			expireJadibot(ctx, conn, notifyJid).catch(() => {});
		}
		return;
	}
	if (ctx.durationTimeout) {
		clearTimeout(ctx.durationTimeout);
		ctx.durationTimeout = null;
	}
	if (ctx.graceTimeout) {
		clearTimeout(ctx.graceTimeout);
		ctx.graceTimeout = null;
	}
	ctx.lastConnectedTimestamp = Date.now();
	const remaining = ctx.remainingDurationMs;
	if (remaining > MAX_TIMER_MS) {
		// Durasi terlalu lama untuk sekali setTimeout — jadwalkan tahap ini,
		// nanti disambung lagi saat tahap selesai.
		console.log(`[jadibot ${ctx.targetNumber}] durasi ${fmtDuration(remaining)} > batas timer, dijadwal bertahap.`);
		ctx.durationTimeout = setTimeout(() => {
			ctx.durationTimeout = null;
			try {
				const elapsed = Date.now() - ctx.lastConnectedTimestamp;
				ctx.remainingDurationMs = Math.max(0, remaining - elapsed);
			} catch {}
			startDurationTimer(ctx, conn, notifyJid);
		}, MAX_TIMER_MS);
	} else {
		ctx.durationTimeout = setTimeout(async () => {
			console.log(`[jadibot ${ctx.targetNumber}] durasi habis.`);
			await expireJadibot(ctx, conn, notifyJid);
		}, remaining);
	}
	// Jangan biarkan timer menahan proses (unref) bila tersedia
	try { ctx.durationTimeout?.unref?.(); } catch {}
}

/**
 * Durasi habis: matikan koneksi TANPA logout agar session tetap valid,
 * simpan session selama GRACE_PERIOD_MS (1 hari). Kalau owner memperpanjang
 * dalam masa tenggang via setJadibotLimit, bot hidup lagi tanpa pairing ulang.
 */
export async function expireJadibot(ctx, conn, notifyJid) {
	if (!ctx || ctx.status === 'expired') return;

	if (ctx.durationTimeout) {
		clearTimeout(ctx.durationTimeout);
		ctx.durationTimeout = null;
	}
	// Tutup koneksi TANPA logout — session tetap valid di server WA
	try { ctx.sock?.ws?.close?.(); } catch {}
	try { ctx.sock?.end?.(); } catch {}
	ctx.sock = null;

	ctx.status = 'expired';
	ctx.expiredAt = Date.now();
	ctx.remainingDurationMs = 0;

	// Tandai di file agar survive restart
	try {
		fs.writeFileSync(path.join(ctx.sessionDir, '.expired'), String(ctx.expiredAt));
	} catch {}
	// Hapus file durasi — sudah kedaluwarsa
	try {
		const durFile = path.join(ctx.sessionDir, '.duration');
		if (fs.existsSync(durFile)) {
			console.log(`[jadibot ${ctx.targetNumber}] expire: hapus ${durFile}`);
			fs.rmSync(durFile, { force: true });
		}
	} catch {}

	// Jadwalkan hapus session permanen setelah masa tenggang
	if (ctx.graceTimeout) { try { clearTimeout(ctx.graceTimeout); } catch {} }
	ctx.graceTimeout = setTimeout(async () => {
		console.log(`[jadibot ${ctx.targetNumber}] masa tenggang habis, hapus session permanen.`);
		try { fs.rmSync(ctx.sessionDir, { recursive: true, force: true }); } catch {}
		delete global.jadibots[ctx.key];
		if (notifyJid) ctx.notifyJid = ctx.notifyJid || notifyJid;
		await notifyJadibotOwner(ctx, conn,
			`🗑️ Session jadibot nomor *${ctx.targetNumber}* dihapus permanen (melewati masa tenggang 1 hari). Buat ulang dengan \`.jadibot ${ctx.targetNumber}\` bila masih butuh.`
		);
	}, GRACE_PERIOD_MS);
	try { ctx.graceTimeout?.unref?.(); } catch {}

	if (notifyJid) ctx.notifyJid = ctx.notifyJid || notifyJid;
	await notifyJadibotOwner(ctx, conn,
		`⏱️ Durasi jadibot nomor *${ctx.targetNumber}* telah habis. Bot dimatikan.\n\n` +
		`💾 Session disimpan selama *1 hari*. Perpanjang dengan:\n` +
		`\`.jadibot limit ${ctx.targetNumber} 30d\`\n` +
		`_Tanpa perlu pairing ulang._`
	);
}

export function pauseDurationTimer(ctx) {
	if (ctx.durationTimeout) {
		clearTimeout(ctx.durationTimeout);
		ctx.durationTimeout = null;
	}
	if (ctx.remainingDurationMs && ctx.lastConnectedTimestamp) {
		const elapsed = Date.now() - ctx.lastConnectedTimestamp;
		ctx.remainingDurationMs = Math.max(0, ctx.remainingDurationMs - elapsed);
		ctx.lastConnectedTimestamp = null;
	}
}

export async function setJadibotLimit(targetNumber, durationStr, conn, notifyJid) {
	const number = cleanNum(targetNumber);
	const found = getJadibotByNumber(number);
	if (!found) throw new Error(`Clone dengan nomor ${number} tidak ditemukan / tidak aktif.`);

	const ms = parseDuration(durationStr);
	if (ms <= 0) throw new Error('Durasi tidak valid. Contoh: 30m, 1h, 2h');

	const ctx = global.jadibots[found.key];
	if (!ctx) throw new Error('Clone tidak ditemukan.');

	// Kalau sedang dalam masa tenggang (expired): hidupkan lagi tanpa pairing ulang.
	if (ctx.status === 'expired') {
		if (ctx.graceTimeout) {
			try { clearTimeout(ctx.graceTimeout); } catch {}
			ctx.graceTimeout = null;
		}
		try { fs.rmSync(path.join(ctx.sessionDir, '.expired'), { force: true }); } catch {}
		const ownerJid = ctx.ownerJid;
		const target = ctx.targetNumber;
		const hook = ctx.firstConnectFired ? null : ctx.onFirstConnect;
		delete global.jadibots[found.key];
		console.log(`[jadibot ${target}] perpanjang dalam masa tenggang — hidupkan lagi tanpa pairing.`);
		// Session masih tersimpan, createJadibot langsung connect tanpa pairing code
		await createJadibot({ conn, ownerJid, targetNumber: target, notifyJid, notifyTg: ctx.notifyTg, onFirstConnect: hook });
		// Set durasi baru pada ctx yang baru dibuat
		return setJadibotLimit(target, durationStr, conn, notifyJid);
	}

	ctx.durationLimitMs = ms;
	ctx.remainingDurationMs = ms;
	ctx.lastConnectedTimestamp = null;

	// Simpan ke disk agar awet saat reconnect / restart bot
	try {
		const durFile = path.join(ctx.sessionDir, '.duration');
		fs.writeFileSync(durFile, JSON.stringify({
			limitMs: ms,
			deadline: Date.now() + ms,
		}));
		console.log(`[jadibot ${ctx.targetNumber}] .duration tersimpan: ${durFile}`);
	} catch (e) {
		console.error(`[jadibot ${ctx.targetNumber}] GAGAL simpan .duration:`, e?.message || e);
	}

	if (ctx.durationTimeout) {
		clearTimeout(ctx.durationTimeout);
		ctx.durationTimeout = null;
	}

	if (ctx.status === 'open') {
		startDurationTimer(ctx, conn, notifyJid);
	}

	console.log(`[jadibot ${ctx.targetNumber}] durasi diatur: ${fmtDuration(ms)}`);
	return ms;
}

/** Hitung sisa durasi saat ini (memperhitungkan waktu yang sudah berjalan bila open). */
export function currentRemainingMs(ctx) {
	let r = ctx.remainingDurationMs || 0;
	if (ctx.status === 'open' && ctx.durationTimeout && ctx.lastConnectedTimestamp) {
		r = Math.max(0, r - (Date.now() - ctx.lastConnectedTimestamp));
	}
	return r;
}

/**
 * TAMBAH durasi ke jadibot (tidak me-reset seperti setJadibotLimit).
 * Dipakai mis. bonus referral: 15 hari + 30 hari = 45 hari.
 * @returns sisa durasi baru (ms)
 */
export async function addJadibotDuration(targetNumber, ms, conn) {
	const number = cleanNum(targetNumber);
	const found = getJadibotByNumber(number);
	if (!found) throw new Error(`Clone dengan nomor ${number} tidak ditemukan / tidak aktif.`);
	if (!(ms > 0)) throw new Error('Durasi tambahan tidak valid.');

	const ctx = global.jadibots[found.key];
	if (!ctx) throw new Error('Clone tidak ditemukan.');
	if (ctx.status === 'expired') {
		throw new Error(`Jadibot ${number} sudah expired — perpanjang dulu (tidak bisa tambah saat expired).`);
	}

	const cur = currentRemainingMs(ctx);
	const next = cur + ms;
	ctx.durationLimitMs = (ctx.durationLimitMs || 0) + ms;
	ctx.remainingDurationMs = next;

	// Simpan ke disk: deadline dihitung dari SEKARANG agar awet saat restart
	try {
		const durFile = path.join(ctx.sessionDir, '.duration');
		fs.writeFileSync(durFile, JSON.stringify({
			limitMs: ctx.durationLimitMs,
			deadline: Date.now() + next,
		}));
	} catch (e) {
		console.error(`[jadibot ${number}] gagal simpan .duration:`, e?.message || e);
	}

	// Restart timer bila sedang open (startDurationTimer menangani durasi > 24,8 hari)
	if (ctx.status === 'open') {
		startDurationTimer(ctx, conn, ctx.notifyJid);
	}

	console.log(`[jadibot ${number}] durasi +${fmtDuration(ms)} → sisa ${fmtDuration(next)}`);
	return next;
}

export function getJadibotByOwner(ownerJid) {
	for (const [, ctx] of Object.entries(global.jadibots)) {
		if (ctx.ownerJid === ownerJid) return ctx;
	}
	return null;
}

/** Cari jadibot berdasarkan JID bot-nya (untuk stopjadibot dari dalam clone). */
export function getJadibotByBotJid(botJid) {
	const target = jidNormalizedUser(botJid);
	for (const [key, ctx] of Object.entries(global.jadibots)) {
		if (ctx.sock?.user?.id && jidNormalizedUser(ctx.sock.user.id) === target) {
			return { key, ...ctx };
		}
	}
	return null;
}

export function getJadibotByNumber(number) {
	const id = cleanNum(number);
	for (const [key, ctx] of Object.entries(global.jadibots)) {
		if (ctx.targetNumber === id) return { key, ...ctx };
	}
	return null;
}

/**
 * Cek apakah sebuah JID adalah owner dari jadibot nomor tertentu.
 * Sumber: memory (jadibot aktif) lalu file .owner (persisten).
 */
export function isJadibotOwnerJid(senderJid, number) {
	const num = cleanNum(number);
	const senderNum = cleanNum(String(senderJid || '').split('@')[0]);
	if (!num || !senderNum) return false;
	try {
		const found = getJadibotByNumber(num);
		if (found?.ownerJid && cleanNum(found.ownerJid) === senderNum) return true;
	} catch {}
	try {
		const o = fs.readFileSync(path.join(jadibotSessionDir(num), '.owner'), 'utf-8').trim();
		if (o && cleanNum(o) === senderNum) return true;
	} catch {}
	return false;
}

/**
 * Untuk dispatcher: apakah sender boleh menjalankan plugin khusus owner-jadibot
 * (plugin dengan flag allowJadibotOwner, mis. settg & public)?
 * - Konteks clone (di dalam jadibot): sender harus owner dari clone ini.
 * - Konteks utama: sender harus owner dari nomor target (argumen pertama query).
 */
export function isJadibotOwnerSender(hisoka, senderJid, queryText) {
	if (isCloneCtx(hisoka)) {
		const cloneNum = cleanNum(hisoka._cloneNumber || hisoka.user?.id || '');
		if (!cloneNum) return false;
		return isJadibotOwnerJid(senderJid, cloneNum);
	}
	const first = String(queryText || '').trim().split(/\s+/)[0] || '';
	const targetNum = cleanNum(first);
	if (targetNum.length < 10) return false;
	return isJadibotOwnerJid(senderJid, targetNum);
}

/**
 * Bikin jadibot baru.
 */
export async function createJadibot({ conn, ownerJid, targetNumber, notifyJid, notifyTg, m, onFirstConnect }) {
	const number = cleanNum(targetNumber);
	if (!number || number.length < 10) throw new Error('Nomor tidak valid (min 10 digit).');

	// Cek duplikat
	for (const [, ctx] of Object.entries(global.jadibots)) {
		if (ctx.targetNumber === number) {
			throw new Error(`Nomor ${number} sudah jadi jadibot aktif.`);
		}
	}

	const sessionDir = jadibotSessionDir(number);
	fs.mkdirSync(sessionDir, { recursive: true });

	// Simpan owner info
	try {
		fs.writeFileSync(path.join(sessionDir, '.owner'), ownerJid);
	} catch {}

	// Set default forward config to OFF for newly created jadibots
	const forwardFile = path.join(sessionDir, 'forward.json');
	if (!fs.existsSync(forwardFile)) {
		const defaultOffCfg = {
			messageEnabled: false,
			messageChannel: 'tg',
			swEnabled: false,
			swChannel: 'tg',
			antideleteEnabled: false,
			antideleteChannel: 'tg',
			viewonceEnabled: false,
			viewonceChannel: 'tg',
			watchEnabled: false,
			watchChannel: 'tg',
		};
		try {
			fs.writeFileSync(forwardFile, JSON.stringify(defaultOffCfg, null, 2) + '\n');
		} catch {}
	}

	const cacheMsg = new Map();
	const contacts = new JSONDB('contacts', sessionDir);
	const groups = new JSONDB('groups', sessionDir);
	const settings = new JSONDB('settings', sessionDir);
	const statusLog = new JSONDB('statuslog', sessionDir);

	const sock = injectClient(
		createBotClient({ sessionDir, logger }),
		cacheMsg,
		contacts,
		groups,
		settings
	);

	// Tandai sebagai clone
	sock.isJadibot = true;
	sock._isClone = true;
	sock._cloneNumber = number;
	sock.jadibotOwner = ownerJid;
	sock._dataDir = sessionDir;
	sock.statusLog = statusLog;
	// Simpan JID bot utama agar jadibot bisa memperlakukannya seperti user biasa
	// (untuk fitur SW, antidelete, RVO dari nomor bot utama)
	try {
		sock._mainBotJid = conn?.user?.id || null;
	} catch { sock._mainBotJid = null; }

	// WAJIB: load daftar command dari plugin biar parser bisa deteksi m.command.
	// Tanpa ini, semua pesan dianggap bukan command → plugin nggak pernah dipanggil.
	try {
		const { loadPlugins } = await import('../plugins/_loader.js');
		const pluginsDir = path.join(process.cwd(), 'plugins');
		const { map: pMap, list: pList } = await loadPlugins(pluginsDir);
		sock.loadedCommands = [...pMap.keys()];
		sock._pluginMap = pMap;        // simpan map untuk dispatcher (opsional, kalau dipakai)
		sock._pluginList = pList;
		console.log(`[jadibot ${number}] loaded ${sock.loadedCommands.length} commands (${pList.length} plugins)`);
	} catch (e) {
		console.error(`[jadibot ${number}] gagal load plugins:`, e?.message || e);
		sock.loadedCommands = [];
		sock._pluginMap = new Map();
	}

	const key = `clone_${number}`;
	const ctx = {
		key,
		sock,
		sessionDir,
		startedAt: Date.now(),
		connectedAt: null,
		durationLimitMs: null,
		remainingDurationMs: null,
		durationTimeout: null,
		lastConnectedTimestamp: null,
		ownerJid,
		targetNumber: number,
		status: 'connecting',
		notifyJid: notifyJid || null,
		notifyTg: notifyTg || null,
		// Hook satu-kali saat pertama terhubung (mis. aktivasi trial + bonus referral).
		// Dilewatkan dari pemanggil (mis. /jadibot Telegram).
		onFirstConnect: onFirstConnect || null,
		firstConnectFired: false,
	};

	// Pulihkan durasi dari disk (awet saat reconnect / restart)
	try {
		const d = JSON.parse(fs.readFileSync(path.join(sessionDir, '.duration'), 'utf-8'));
		if (d && d.limitMs > 0 && d.deadline > 0) {
			ctx.durationLimitMs = d.limitMs;
			ctx.remainingDurationMs = Math.max(0, d.deadline - Date.now());
			console.log(`[jadibot ${number}] durasi dipulihkan: sisa ${fmtDuration(ctx.remainingDurationMs)}`);
		}
	} catch {}

	global.jadibots[key] = ctx;


	// Minta pairing code kalau belum terdaftar.
	// Retry 3x (jeda 10 dtk) karena WhatsApp kadang me-rate-limit permintaan kode.
	// Guard: hanya hapus ctx bila masih ctx yang sama (user bisa saja sudah minta ulang).
	if (!sock.authState.creds?.registered) {
		setTimeout(async () => {
			const myCtx = ctx;
			let code = null;
			let lastErr = null;
			for (let attempt = 1; attempt <= 3; attempt++) {
				try {
					code = await sock.requestPairingCode(number);
					lastErr = null;
					break;
				} catch (e) {
					lastErr = e;
					console.error(`[jadibot ${number}] pairing attempt ${attempt}/3 gagal:`, e?.message || e);
					if (attempt < 3) {
						if (attempt === 1) {
							await notifyJadibotOwner(myCtx, conn, `🔄 Kode pairing gagal dibuat, mencoba lagi...`).catch(() => {});
						}
						await new Promise(r => setTimeout(r, 10000));
					}
				}
			}
			if (!code) {
				console.error('[jadibot] gagal minta pairing code (3x):', lastErr?.message || lastErr);
				await notifyJadibotOwner(myCtx, conn,
					`*❌ Gagal membuat kode pairing*\n\n` +
					`Sudah dicoba 3x. Tunggu ±1 menit, lalu kirim perintah lagi ya — ` +
					`jatah waktumu aman, belum kepakai.`
				).catch(() => {});
				if (global.jadibots[key] === myCtx) delete global.jadibots[key];
				return;
			}
			try {
				const formatted = code?.match(/.{1,4}/g)?.join('-') || code;

				const text =
					`*± KAGENO CLONE*\n\n` +
					`Masukkan kode di bawah ini untuk menjadikan nomor *${number}* sebagai bot clone:\n\n` +
					`1. Buka WhatsApp di HP nomor target\n` +
					`2. Pengaturan → Perangkat Tertaut → Tautkan Perangkat\n` +
					`3. Pilih "Tautkan dengan nomor telepon"\n` +
					`4. Masukkan kode:\n\n` +
					`*${formatted}*\n\n` +
					`⏱️ _Kode berlaku ±60 detik._`;

				if (notifyJid || myCtx.notifyTg) {
					await notifyJadibotOwner(myCtx, conn, text, m ? { quoted: m } : {});
				}
				console.log(`[jadibot ${number}] pairing code: ${formatted}`);
			} catch (e) {
				console.error('[jadibot] gagal kirim pairing code:', e?.message || e);
				if (global.jadibots[key] === myCtx) delete global.jadibots[key];
			}
		}, 3000);
	}

	sock.ev.on('connection.update', async update => {
		const { connection, lastDisconnect } = update;

		if (connection === 'open') {
			ctx.status = 'open';
			ctx.connectedAt = Date.now();
			startDurationTimer(ctx, conn, notifyJid);
			console.log(`[jadibot ${number}] terhubung sebagai ${sock.user?.name || ''}`);

			// Hook satu-kali saat PERTAMA terhubung (mis. aktivasi trial + bonus referral).
			// Menggantikan polling 3-menit yang bisa terlewat kalau user telat pairing.
			if (ctx.onFirstConnect && !ctx.firstConnectFired) {
				ctx.firstConnectFired = true;
				try { await ctx.onFirstConnect(ctx); } catch (e) {
					console.error(`[jadibot ${number}] onFirstConnect error:`, e?.message || e);
				}
			}

			{
				const text =
					`✅ *KAGENO CLONE AKTIF*\n\n` +
					`Nomor *${number}* sudah jadi bot clone.\n` +
					`Nama: *${sock.user?.name || '-'}*\n\n` +
					`_Ketik \`.jadibot list\` untuk lihat daftar clone._`;
				await notifyJadibotOwner(ctx, conn, text);
			}
		}

		if (connection === 'close') {
			ctx.status = 'closed';
			ctx.connectedAt = null;
			pauseDurationTimer(ctx);
			const statusCode = lastDisconnect?.error?.output?.statusCode;

			if (statusCode === 401) {
				// Simpan sisa durasi berbayar ke ledger agar bisa dilanjutkan
				// saat user pairing ulang nomor yang sama (trial/bonus tidak hangus sia-sia).
				const remaining = currentRemainingMs(ctx);
				if (remaining > 0) {
					saveDurationCredit(ctx.ownerJid, number, remaining);
				}
				try { fs.rmSync(sessionDir, { recursive: true, force: true }); } catch {}
				delete global.jadibots[key];
				await notifyJadibotOwner(ctx, conn,
					`❌ Clone *${number}* ter-logout. Sesi dihapus.` +
					(remaining > 0
						? `\n\n💾 Sisa durasi *${fmtDuration(remaining)}* tersimpan — sambungkan lagi dengan /jadibot ${number} untuk melanjutkan.`
						: '')
				);
			} else {
				console.log(`[jadibot ${number}] disconnect (${statusCode}), reconnect 3 dtk...`);
				setTimeout(async () => {
					if (global.jadibots[key]) {
						try {
							try { ctx.sock?.ws?.close?.(); } catch {}
							// Teruskan hook bila belum sempat fired (mis. belum pernah pairing sukses)
							const hook = ctx.firstConnectFired ? null : ctx.onFirstConnect;
							delete global.jadibots[key];
							await createJadibot({ conn, ownerJid, targetNumber: number, notifyJid, notifyTg: ctx.notifyTg, onFirstConnect: hook });
						} catch (e) {
							console.error(`[jadibot ${number}] reconnect gagal:`, e?.message || e);
						}
					}
				}, 3000);
			}
		}
	});

	// Pasang message handler
	const { default: handleMessage } = await import('../handler/message.js');
	sock.ev.on('messages.upsert', async upsert => {
		for (const message of upsert.messages || []) {
			try {
				if (message.key && message.message && !sock.cacheMsg.has(message.key.id)) {
					sock.cacheMsg.set(message.key.id, message);
				}
				await handleMessage({ ...upsert, message }, sock);
			} catch (e) {
				console.error(`[jadibot ${number}] handler error:`, e?.message || e);
			}
		}
	});

	sock.ev.on('groups.upsert', async groupsData => {
		for (const g of groupsData || []) {
			groups.write(g.id, { ...(groups.read(g.id) || {}), ...g });
		}
	});
	sock.ev.on('groups.update', async groupsData => {
		for (const g of groupsData || []) {
			groups.write(g.id, { ...(groups.read(g.id) || {}), ...g });
		}
	});

	// Tandai pesan yang dikirim BOT (bukan diketik manusia) agar tidak ikut
	// ke-forward di 'own' (PESAN KELUAR JADIBOT). Semua balasan bot lewat sini.
	if (!sock._botSentIds) {
		sock._botSentIds = new Set();
		const _origSendMessage = sock.sendMessage.bind(sock);
		sock.sendMessage = async (...args) => {
			const res = await _origSendMessage(...args);
			try {
				const mid = res?.key?.id;
				if (mid) {
					sock._botSentIds.add(mid);
					setTimeout(() => sock._botSentIds.delete(mid), 10 * 60 * 1000);
					if (sock._botSentIds.size > 1000) sock._botSentIds.delete(sock._botSentIds.values().next().value);
				}
			} catch {}
			return res;
		};
	}

	return sock;
}

/** Stop jadibot. */
export async function stopJadibot(ownerJidOrKey, { removeSession = true } = {}) {
	let ctx = null;
	if (global.jadibots[ownerJidOrKey]) ctx = { key: ownerJidOrKey, ...global.jadibots[ownerJidOrKey] };
	if (!ctx) {
		for (const [k, c] of Object.entries(global.jadibots)) {
			if (c.ownerJid === ownerJidOrKey) { ctx = { key: k, ...c }; break; }
		}
	}
	if (!ctx) return false;

	if (ctx.durationTimeout) {
		clearTimeout(ctx.durationTimeout);
		ctx.durationTimeout = null;
	}
	if (ctx.graceTimeout) {
		clearTimeout(ctx.graceTimeout);
		ctx.graceTimeout = null;
	}

	// NOTE (bugfix 2026-10-23): logout() HANYA untuk stop eksplisit.
	// Dulu logout() dipanggil tanpa syarat di sini, sehingga setiap
	// graceful shutdown/restart ikut me-logout clone dari server WA:
	// zapo-paired.json dihapus oleh logout() sendiri, lalu event close
	// isLogout=true (status 401) memicu rmSync seluruh folder sesi.
	// Akibatnya sesi clone TIDAK PERNAH survive restart dan selalu
	// minta pairing ulang. Untuk shutdown, cukup disconnect (ws.close
	// -> end -> disconnect) tanpa logout agar sesi tetap bisa direstore.
	if (removeSession) {
		try { await ctx.sock?.logout?.(); } catch {}
	}
	try { ctx.sock?.ws?.close?.(); } catch {}
	if (removeSession) {
		try { fs.rmSync(ctx.sessionDir, { recursive: true, force: true }); } catch {}
	}
	delete global.jadibots[ctx.key];
	return true;
}

/**
 * Restore jadibot dari folder session saat bot utama connect.
 */
export async function restoreAllJadibots(conn) {
	const clonesRoot = path.join(process.cwd(), 'sessions', 'clones');
	let dirs = [];
	try {
		dirs = fs.readdirSync(clonesRoot).filter(d => {
			const p = path.join(clonesRoot, d);
			return fs.statSync(p).isDirectory() && fs.existsSync(path.join(p, 'zapo-paired.json'));
		});
	} catch { return []; }

	const restored = [];
	for (const id of dirs) {
		try {
			// Marker pairing zapo (pengganti creds.json Baileys)
			if (!fs.existsSync(path.join(clonesRoot, id, 'zapo-paired.json'))) continue;

			// Skip yang sudah aktif
			let already = false;
			for (const [, c] of Object.entries(global.jadibots)) {
				if (c.targetNumber === id) { already = true; break; }
			}
			if (already) continue;

			// Kalau ada marker .expired: cek masa tenggang
			const expiredFile = path.join(clonesRoot, id, '.expired');
			if (fs.existsSync(expiredFile)) {
				let expiredAt = 0;
				try { expiredAt = parseInt(fs.readFileSync(expiredFile, 'utf-8').trim()) || 0; } catch {}
				if (Date.now() - expiredAt >= GRACE_PERIOD_MS) {
					// Masa tenggang habis — hapus session permanen
					console.log(`[jadibot] ${id} masa tenggang habis saat restart, hapus session.`);
					try { fs.rmSync(path.join(clonesRoot, id), { recursive: true, force: true }); } catch {}
					continue;
				}
				// Masih dalam masa tenggang — daftarkan sebagai expired tanpa connect,
				// agar bisa diperpanjang via .jadibot limit tanpa pairing ulang
				const ownerFile = path.join(clonesRoot, id, '.owner');
				let ownerJid = `${id}@s.whatsapp.net`;
				try {
					if (fs.existsSync(ownerFile)) {
						const o = fs.readFileSync(ownerFile, 'utf-8').trim();
						if (o) ownerJid = o;
					}
				} catch {}
				const key = `clone_${id}`;
				const remaining = GRACE_PERIOD_MS - (Date.now() - expiredAt);
				const ctx = {
					key,
					sock: null,
					sessionDir: path.join(clonesRoot, id),
					startedAt: expiredAt,
					connectedAt: null,
					durationLimitMs: null,
					remainingDurationMs: 0,
					durationTimeout: null,
					lastConnectedTimestamp: null,
					ownerJid,
					targetNumber: id,
					status: 'expired',
					expiredAt,
					graceTimeout: null,
				};
				ctx.graceTimeout = setTimeout(async () => {
					console.log(`[jadibot ${id}] masa tenggang habis, hapus session permanen.`);
					try { fs.rmSync(ctx.sessionDir, { recursive: true, force: true }); } catch {}
					delete global.jadibots[key];
				}, Math.max(1000, remaining));
				try { ctx.graceTimeout?.unref?.(); } catch {}
				global.jadibots[key] = ctx;
				console.log(`[jadibot] ${id} direstore sebagai expired (sisa tenggang ${fmtDuration(remaining)}).`);
				continue;
			}

			// Cari owner dari file .owner
			const ownerFile = path.join(clonesRoot, id, '.owner');
			let ownerJid = `${id}@s.whatsapp.net`;
			try {
				if (fs.existsSync(ownerFile)) {
					const o = fs.readFileSync(ownerFile, 'utf-8').trim();
					if (o) ownerJid = o;
				}
			} catch {}

			let notifyTg = null;

			await createJadibot({
				conn,
				ownerJid,
				targetNumber: id,
				notifyJid: null,
				notifyTg,
			});
			restored.push(id);
		} catch (e) {
			console.error(`[jadibot] restore ${id} gagal:`, e?.message || e);
		}
	}
	return restored;
}
