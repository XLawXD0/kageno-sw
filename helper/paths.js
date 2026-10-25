'use strict';
// Resolve path data per-instance (bot utama vs jadibot).

import fs from 'fs';
import path from 'path';

export function getDataDir(hisoka) {
	if (hisoka?._dataDir) return hisoka._dataDir;
	if (hisoka?.isJadibot || hisoka?._isClone) {
		const num = hisoka._cloneNumber || (hisoka.jadibotOwner || '').split('@')[0] || 'unknown';
		const dir = path.join(process.cwd(), 'sessions', 'clones', num);
		try { fs.mkdirSync(dir, { recursive: true }); } catch {}
		return dir;
	}
	return process.cwd();
}

export function isCloneCtx(hisoka) {
	return !!(hisoka?.isJadibot || hisoka?._isClone);
}

/** File di root project (bot utama) atau folder session (clone). */
export function rootPath(hisoka, filename) {
	if (isCloneCtx(hisoka)) return path.join(getDataDir(hisoka), filename);
	return path.join(process.cwd(), filename);
}

/** File di folder data/ (bot utama) atau folder data di dalam session (clone). */
export function dataDirPath(hisoka, filename) {
	if (isCloneCtx(hisoka)) {
		const dir = path.join(getDataDir(hisoka), 'data');
		try { fs.mkdirSync(dir, { recursive: true }); } catch {}
		return path.join(dir, filename);
	}
	return path.join(process.cwd(), 'data', filename);
}

/** Alias lama. */
export function dataPath(hisoka, filename) {
	return rootPath(hisoka, filename);
}

/** Konfigurasi Telegram per-instance (user-facing). */
export function getTelegramCfg(hisoka) {
	if (isCloneCtx(hisoka)) {
		try {
			const f = path.join(getDataDir(hisoka), 'telegram.json');
			const d = JSON.parse(fs.readFileSync(f, 'utf-8') || '{}');
			return {
				chatId: String(d.chatId || '').trim(),
				token: String(d.token || '').trim(),
			};
		} catch {
			return { chatId: '', token: '' };
		}
	}
	// Bot utama: telegram.json (hasil .settg) didahulukan per-field;
	// field yang kosong jatuh ke settings.js (env).
	let fileChat = '', fileTok = '';
	try {
		const d = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'telegram.json'), 'utf-8') || '{}');
		fileChat = String(d.chatId || '').trim();
		fileTok = String(d.token || '').trim();
	} catch {}
	const chatId = fileChat || String(process.env.TELEGRAM_OWNER_ID || process.env.TELEGRAM_CHAT_ID || '').trim();
	const token = fileTok || String(process.env.TELEGRAM_TOKEN || '').trim();
	return { chatId, token };
}

export function hasTelegram(hisoka) {
	const t = getTelegramCfg(hisoka);
	return !!(t.chatId && t.token);
}

