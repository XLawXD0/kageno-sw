'use strict';

import { execFile } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import os from 'os';

const execFileAsync = promisify(execFile);

// pinterest-scraper (EhsanShahbazii, MIT) terinstall di venv downloader
const PIN_SCRAPER = '/home/hatch/workspace/tiktokbot/venv/bin/pinterest-scraper';

/**
 * Cari gambar di Pinterest berdasarkan kata kunci, unduh N teratas.
 * @param {string} query kata kunci, mis. "kucing lucu"
 * @param {number} count jumlah gambar (1-10)
 * @returns {Promise<{files: string[], query: string}>} path file gambar
 */
export async function searchPinterest(query, count = 5) {
	count = Math.max(1, Math.min(10, count || 5));
	const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pin-'));

	try {
		await execFileAsync(
			PIN_SCRAPER,
			['search', query, '-n', String(count), '--download', '-o', tmpDir, '--delay', '1'],
			{ timeout: 180000 }
		);

		const imgDir = path.join(tmpDir, 'images');
		const files = fs.existsSync(imgDir)
			? fs.readdirSync(imgDir).filter(f => /\.(jpe?g|png|webp|gif)$/i.test(f)).map(f => path.join(imgDir, f))
			: [];

		if (!files.length) {
			throw new Error('Tidak ketemu gambarnya, coba kata kunci lain.');
		}

		return { files: files.slice(0, count), query, tmpDir };
	} catch (err) {
		fs.rmSync(tmpDir, { recursive: true, force: true });
		if (err && err.message === 'Tidak ketemu gambarnya, coba kata kunci lain.') throw err;
		throw new Error('Gagal mencari di Pinterest. Coba lagi.');
	}
}

/**
 * Unduh gambar dari URL pin Pinterest langsung.
 * @param {string} url URL pin, mis. https://www.pinterest.com/pin/123.../
 * @returns {Promise<{files: string[], tmpDir: string}>}
 */
export async function downloadPinterestPin(url) {
	const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pin-'));

	try {
		await execFileAsync(PIN_SCRAPER, ['pin', url, '--download', '-o', tmpDir, '--delay', '1'], {
			timeout: 120000,
		});

		const imgDir = path.join(tmpDir, 'images');
		const files = fs.existsSync(imgDir)
			? fs.readdirSync(imgDir).filter(f => /\.(jpe?g|png|webp|gif)$/i.test(f)).map(f => path.join(imgDir, f))
			: [];

		if (!files.length) {
			throw new Error('Gagal mengunduh pin tersebut.');
		}

		return { files, tmpDir };
	} catch (err) {
		fs.rmSync(tmpDir, { recursive: true, force: true });
		if (err && err.message === 'Gagal mengunduh pin tersebut.') throw err;
		throw new Error('Gagal mengunduh pin. Pastikan link valid.');
	}
}

/**
 * Hapus direktori temp hasil download.
 * @param {string} tmpDir dari searchPinterest()/downloadPinterestPin()
 */
export function cleanupPinterest(tmpDir) {
	try {
		fs.rmSync(tmpDir, { recursive: true, force: true });
	} catch {
		// abaikan
	}
}
