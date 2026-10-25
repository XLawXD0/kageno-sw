'use strict';

import fs from 'fs';
import path from 'path';
import os from 'os';
import { execFile } from 'child_process';
import util from 'util';

const execFileAsync = util.promisify(execFile);
const UA =
	'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';

/**
 * Ambil info pack stiker dari sticker.ly.
 * @param {string} urlOrId link https://sticker.ly/s/XXXXXX atau kode pack 6 karakter
 * @returns {Promise<{name: string, packId: string, stickers: string[]}>}
 */
export async function getStickerPack(urlOrId) {
	let packId = '';
	const mUrl = String(urlOrId).match(/sticker\.ly\/s\/([A-Za-z0-9]{4,10})/i);
	if (mUrl) packId = mUrl[1].toUpperCase();
	else if (/^[A-Za-z0-9]{4,10}$/.test(String(urlOrId).trim())) packId = String(urlOrId).trim().toUpperCase();
	if (!packId) throw new Error('Kasih link sticker.ly yang valid. Contoh: .spack https://sticker.ly/s/M3XUY1');

	const res = await fetch(`https://sticker.ly/s/${packId}`, { headers: { 'User-Agent': UA } });
	if (!res.ok) throw new Error('Pack tidak ketemu. Cek link-nya.');
	const html = await res.text();

	// Nama pack dari <title> atau og:title
	const titleM = html.match(/<meta[^>]*property="og:title"[^>]*content="([^"]+)"/i) || html.match(/<title>([^<]+)<\/title>/i);
	const name = (titleM ? titleM[1] : packId).replace(/\s*\|.*$/, '').trim();

	// URL stiker full (bukan preview): sticker_pack/<hash>/<pack>/<n>/<uuid>.webp
	const urls = [...html.matchAll(/https:\/\/stickerly\.pstatic\.net\/sticker_pack\/[A-Za-z0-9_-]+\/[A-Za-z0-9]+\/\d+\/[a-z0-9-]+\.webp/gi)]
		.map(m => m[0])
		.filter((v, i, a) => a.indexOf(v) === i);
	if (!urls.length) throw new Error('Tidak ada stiker di pack ini.');
	return { name, packId, stickers: urls };
}

/**
 * Baca dimensi canvas file WebP (VP8X / VP8).
 * @returns {{w:number,h:number}|null}
 */
function webpSize(buf) {
	try {
		if (buf.length < 30 || buf.toString('ascii', 0, 4) !== 'RIFF' || buf.toString('ascii', 8, 12) !== 'WEBP') return null;
		const tag = buf.toString('ascii', 12, 16);
		if (tag === 'VP8X') {
			const w = buf.readUIntLE(24, 3) + 1;
			const h = buf.readUIntLE(27, 3) + 1;
			return { w, h };
		}
		if (tag === 'VP8 ') {
			// cari signature 9D 012A dalam 32 byte pertama
			for (let i = 20; i < 40 && i + 6 < buf.length; i++) {
				if (buf[i] === 0x9d && buf[i + 1] === 0x01 && buf[i + 2] === 0x2a) {
					const w = buf.readUInt16LE(i + 3) & 0x3fff;
					const h = buf.readUInt16LE(i + 5) & 0x3fff;
					return { w, h };
				}
			}
		}
	} catch { /* abaikan */ }
	return null;
}
/**
 * Unduh & siapkan stiker jadi webp siap kirim.
 * File WebP yang sudah 512x512 (umumnya dari sticker.ly) dipakai langsung
 * agar stiker animasi tidak rusak; sisanya dikonversi via ffmpeg.
 * @param {string[]} urls daftar URL stiker
 * @param {number} limit maksimal stiker
 * @returns {Promise<{files: string[], tmpDir: string, total: number}>}
 */
export async function downloadStickerPack(urls, limit = 15) {
	limit = Math.max(1, Math.min(30, limit || 15));
	const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sp-'));
	const files = [];
	try {
		const take = urls.slice(0, limit);
		for (let i = 0; i < take.length; i++) {
			const raw = path.join(tmpDir, `raw${i}.webp`);
			const out = path.join(tmpDir, `sticker${i}.webp`);
			const res = await fetch(take[i], { headers: { 'User-Agent': UA } });
			if (!res.ok) continue;
			const data = Buffer.from(await res.arrayBuffer());
			if (!data.length) continue;
			fs.writeFileSync(raw, data);
			// Sudah webp 512x512 -> pakai langsung (aman untuk animasi)
			const dim = webpSize(data);
			if (dim && dim.w === 512 && dim.h === 512) {
				fs.renameSync(raw, out);
				files.push(out);
				continue;
			}
			try {
				await execFileAsync('/usr/bin/ffmpeg', [
					'-y', '-i', raw,
					'-vf', 'scale=512:512:force_original_aspect_ratio=decrease,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=0x00000000',
					'-vcodec', 'libwebp', '-qscale', '75', '-preset', 'default',
					'-loop', '0', '-an', '-vsync', '0', out,
				], { timeout: 60000 });
				if (fs.existsSync(out)) files.push(out);
			} catch { /* stiker rusak -> lewati */ }
			try { fs.unlinkSync(raw); } catch { /* abaikan */ }
		}
		if (!files.length) throw new Error('Gagal mengunduh stiker pack.');
		return { files, tmpDir, total: urls.length };
	} catch (err) {
		fs.rmSync(tmpDir, { recursive: true, force: true });
		throw err;
	}
}

/** Hapus direktori sementara sticker pack. */
export function cleanupStickerPack(tmpDir) {
	if (tmpDir) fs.rmSync(tmpDir, { recursive: true, force: true });
}
