'use strict';

import fs from 'fs';
import path from 'path';
import os from 'os';

const UA =
	'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';

function tgApi(method, params = {}) {
	const token = process.env.TELEGRAM_TOKEN || '';
	if (!token) throw new Error('TELEGRAM_TOKEN belum diset di settings.js');
	const body = new URLSearchParams(params);
	return fetch(`https://api.telegram.org/bot${token}/${method}`, {
		method: 'POST',
		body,
		headers: { 'User-Agent': UA },
	}).then(async r => {
		const j = await r.json();
		if (!j.ok) throw new Error('Pack Telegram tidak ketemu. Cek nama/link-nya.');
		return j.result;
	});
}

/**
 * Ambil info sticker set Telegram.
 * @param {string} nameOrUrl nama set atau link t.me/addstickers/<Name>
 * @returns {Promise<{title: string, name: string, stickers: Array<{file_id, animated, video}>}>}
 */
export async function getTelegramPack(nameOrUrl) {
	let name = String(nameOrUrl).trim();
	const m = name.match(/(?:t\.me\/addstickers\/|addstickers\/)([A-Za-z0-9_]+)/i);
	if (m) name = m[1];
	if (!/^[A-Za-z0-9_]{3,64}$/.test(name)) {
		throw new Error('Kasih nama pack atau link t.me/addstickers/<nama>. Contoh: .tpack AnimeEmojis');
	}
	const set = await tgApi('getStickerSet', { name });
	const stickers = (set.stickers || []).map(s => ({
		file_id: s.file_id,
		animated: !!s.is_animated,
		video: !!s.is_video,
	}));
	return { title: set.title || name, name: set.name, stickers };
}

/**
 * Unduh stiker statis (webp) dari pack Telegram.
 * Stiker animasi (.tgs) & video (.webm) dilewati.
 * @param {Array<{file_id, animated, video}>} stickers
 * @param {number} limit maksimal stiker
 * @returns {Promise<{files: string[], tmpDir: string, total: number, skipped: number}>}
 */
export async function downloadTelegramPack(stickers, limit = 15) {
	limit = Math.max(1, Math.min(30, limit || 15));
	const token = process.env.TELEGRAM_TOKEN || '';
	const statics = stickers.filter(s => !s.animated && !s.video);
	const skipped = stickers.length - statics.length;
	const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tg-'));
	const files = [];
	try {
		for (const s of statics.slice(0, limit)) {
			const f = await tgApi('getFile', { file_id: s.file_id });
			if (!f.file_path) continue;
			const url = `https://api.telegram.org/file/bot${token}/${f.file_path}`;
			const res = await fetch(url, { headers: { 'User-Agent': UA } });
			if (!res.ok) continue;
			const data = Buffer.from(await res.arrayBuffer());
			if (data.length < 100) continue;
			const out = path.join(tmpDir, `tg${files.length}.webp`);
			fs.writeFileSync(out, data);
			files.push(out);
		}
		if (!files.length) throw new Error('Tidak ada stiker statis di pack ini.');
		return { files, tmpDir, total: stickers.length, skipped };
	} catch (err) {
		fs.rmSync(tmpDir, { recursive: true, force: true });
		throw err;
	}
}

/** Hapus direktori sementara. */
export function cleanupTelegramPack(tmpDir) {
	if (tmpDir) fs.rmSync(tmpDir, { recursive: true, force: true });
}
