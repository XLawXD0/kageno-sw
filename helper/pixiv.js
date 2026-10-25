'use strict';

import fs from 'fs';
import path from 'path';
import os from 'os';

const UA =
	'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';
const REFERER = 'https://www.pixiv.net/';

/**
 * Cari ilustrasi di Pixiv berdasarkan kata kunci, unduh N teratas (halaman pertama).
 * R-18 (xRestrict) dilewati.
 * @param {string} query kata kunci
 * @param {number} count jumlah gambar (1-10)
 * @returns {Promise<{files: string[], tmpDir: string, query: string}>}
 */
export async function searchPixiv(query, count = 5) {
	count = Math.max(1, Math.min(10, count || 5));
	const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'px-'));

	try {
		const q = encodeURIComponent(query);
		const res = await fetch(
			`https://www.pixiv.net/ajax/search/artworks/${q}?word=${q}&order=date_d&mode=all&p=1&s_mode=s_tag&type=all&lang=en`,
			{ headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(30000) }
		);
		if (!res.ok) throw new Error('search gagal');
		const json = await res.json();
		const data = json?.body?.illustManga?.data || [];

		// Ambil secukupnya
		const ids = [];
		for (const it of data) {
			if (it.illustType === 2) continue; // lewati ugoira (animasi)
			ids.push(it.id);
			if (ids.length >= count) break;
		}
		if (!ids.length) {
			throw new Error('Tidak ketemu gambarnya, coba kata kunci lain.');
		}

		const files = await downloadArtworks(ids, tmpDir);
		if (!files.length) {
			throw new Error('Tidak ketemu gambarnya, coba kata kunci lain.');
		}
		return { files, tmpDir, query };
	} catch (err) {
		fs.rmSync(tmpDir, { recursive: true, force: true });
		if (err && /^(Tidak ketemu|search gagal)/.test(err.message)) throw err;
		throw new Error('Gagal mencari di Pixiv. Coba lagi.');
	}
}

/**
 * Unduh semua halaman dari sebuah artwork Pixiv.
 * @param {string} artworkId ID angka artwork
 * @returns {Promise<{files: string[], tmpDir: string}>}
 */
export async function downloadPixivArtwork(artworkId) {
	const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'px-'));
	try {
		const files = await downloadArtworks([artworkId], tmpDir, true);
		if (!files.length) {
			throw new Error('Gagal mengunduh artwork tersebut.');
		}
		return { files, tmpDir };
	} catch (err) {
		fs.rmSync(tmpDir, { recursive: true, force: true });
		if (err && err.message === 'Gagal mengunduh artwork tersebut.') throw err;
		throw new Error('Gagal mengunduh artwork. Pastikan link valid.');
	}
}

/**
 * Ambil URL original tiap artwork lalu unduh (paralel).
 * @param {string[]} ids
 * @param {string} tmpDir
 * @param {boolean} allPages unduh semua halaman (untuk URL artwork langsung)
 */
async function downloadArtworks(ids, tmpDir, allPages = false) {
	const jobs = ids.map(async (id, idx) => {
		try {
			const res = await fetch(`https://www.pixiv.net/ajax/illust/${id}/pages?lang=en`, {
				headers: { 'User-Agent': UA },
				signal: AbortSignal.timeout(30000),
			});
			if (!res.ok) return [];
			const json = await res.json();
			const pages = json?.body || [];
			const targets = allPages ? pages : pages.slice(0, 1);
			const out = [];
			for (let p = 0; p < targets.length; p++) {
				const url = targets[p]?.urls?.original;
				if (!url) continue;
				const ext = (url.split('.').pop() || 'jpg').split(/[?#]/)[0].slice(0, 4);
				const dest = path.join(tmpDir, `${String(idx).padStart(2, '0')}_${id}_p${p}.${ext}`);
				const ok = await downloadFile(url, dest);
				if (ok) out.push(dest);
			}
			return out;
		} catch {
			return [];
		}
	});

	const nested = await Promise.all(jobs);
	return nested.flat();
}

/** Unduh satu file dengan header Referer Pixiv. */
async function downloadFile(url, dest) {
	try {
		const res = await fetch(url, {
			headers: { 'User-Agent': UA, Referer: REFERER },
			signal: AbortSignal.timeout(120000),
		});
		if (!res.ok || !res.body) return false;
		const buf = Buffer.from(await res.arrayBuffer());
		if (buf.length < 1024) return false;
		fs.writeFileSync(dest, buf);
		return true;
	} catch {
		return false;
	}
}

/**
 * Hapus direktori temp hasil download.
 * @param {string} tmpDir
 */
export function cleanupPixiv(tmpDir) {
	try {
		fs.rmSync(tmpDir, { recursive: true, force: true });
	} catch {
		// abaikan
	}
}
