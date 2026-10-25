'use strict';

// Download audio YouTube — strategi berlapis:
// 1. Neoxr API (server pihak ketiga, anti-block YouTube)
// 2. yt-dlp multi-client (android -> ios -> web -> tv) + fallback HTML
// Cache lokal untuk query yang sudah pernah didownload.

import { execFile } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import os from 'os';

const execFileAsync = promisify(execFile);

const YTDLP = process.env.YTDLP_PATH || '/home/hatch/workspace/tiktokbot/venv/bin/yt-dlp';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';
const MAX_DURATION = 20 * 60;

// Neoxr API — API key publik dari config Renzona (gratis).
// Bisa diganti via env NEOXR_APIKEY kalau key ini mati/rate-limit.
const NEOXR_APIKEY = process.env.NEOXR_APIKEY || 'Fahridev12Z';
const NEOXR_BASE = 'https://api.neoxr.eu/api';

// Cache lagu: query yang sudah pernah didownload tidak perlu ambil ulang.
// Hemat dari YouTube block + lebih cepat.
const CACHE_DIR = path.join(process.cwd(), 'downloads', 'ytcache');
const CACHE_MAX = 50;

function cacheKey(query) {
	return query.toLowerCase().trim().replace(/[^a-z0-9]+/g, '_').slice(0, 60);
}

function getCached(query) {
	try {
		if (!fs.existsSync(CACHE_DIR)) return null;
		const key = cacheKey(query);
		const files = fs.readdirSync(CACHE_DIR).filter(f => f.startsWith(key + '__'));
		if (!files.length) return null;
		// file: <key>__<title>.mp3
		const file = path.join(CACHE_DIR, files[0]);
		if (fs.statSync(file).size < 20 * 1024) return null;
		// sentuh biar jadi paling baru (LRU)
		const now = new Date();
		fs.utimesSync(file, now, now);
		const title = files[0].slice(key.length + 2, -4).replace(/_/g, ' ');
		return { file, title };
	} catch { return null; }
}

function putCache(query, srcFile, title) {
	try {
		if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });
		const key = cacheKey(query);
		const safeTitle = (title || 'audio').replace(/[^\w\- ]+/g, '').replace(/\s+/g, '_').slice(0, 50) || 'audio';
		const dest = path.join(CACHE_DIR, `${key}__${safeTitle}.mp3`);
		fs.copyFileSync(srcFile, dest);
		// Pangkas cache ke CACHE_MAX file (hapus yang paling lama)
		const files = fs.readdirSync(CACHE_DIR)
			.map(f => ({ f, t: fs.statSync(path.join(CACHE_DIR, f)).mtimeMs }))
			.sort((a, b) => a.t - b.t);
		while (files.length > CACHE_MAX) {
			const old = files.shift();
			try { fs.unlinkSync(path.join(CACHE_DIR, old.f)); } catch {}
		}
	} catch { /* abaikan */ }
}

// Urutan client: yang paling tahan SABR dulu
const CLIENTS = ['android', 'ios', 'web', 'tv'];

/** Cari 1 videoId via yt-dlp ytsearch1 dengan client tertentu. */
async function searchViaYtDlp(query, client) {
	const { stdout } = await execFileAsync(
		YTDLP,
		[
			'--no-playlist', '--no-warnings',
			'--extractor-args', `youtube:player_client=${client}`,
			'--print', '%(id)s\n%(title)s\n%(duration)s',
			'--socket-timeout', '20',
			`ytsearch1:${query}`,
		],
		{ timeout: 60000 }
	);
	const [id, title, dur] = stdout.trim().split('\n');
	if (!id || !/^[a-zA-Z0-9_-]{11}$/.test(id)) throw new Error('no result');
	return { id, title: title || id, duration: parseInt(dur) || 0 };
}

/** Fallback: scraping halaman search YouTube langsung (tanpa yt-dlp). */
async function searchViaHtml(query) {
	const url = 'https://www.youtube.com/results?search_query=' + encodeURIComponent(query);
	const res = await fetch(url, { headers: { 'User-Agent': UA, 'Accept-Language': 'en-US,en;q=0.9' } });
	if (!res.ok) throw new Error(`HTTP ${res.status}`);
	const html = await res.text();
	const m = html.match(/"videoId":"([a-zA-Z0-9_-]{11})"/);
	if (!m) throw new Error('no result');
	const id = m[1];
	const tm = html.slice(m.index, m.index + 2000).match(/"title":\{"runs":\[{"text":"((?:[^"\\]|\\.){1,120})/);
	let title = id;
	if (tm) {
		try { title = JSON.parse(`"${tm[1]}"`); } catch { title = tm[1]; }
	}
	return { id, title, duration: 0 };
}

/** Cari video: coba tiap client, terakhir fallback HTML. */
async function findVideo(query) {
	for (const client of CLIENTS) {
		try {
			const v = await searchViaYtDlp(query, client);
			return { ...v, client };
		} catch { /* coba client berikutnya */ }
	}
	try {
		const v = await searchViaHtml(query);
		return { ...v, client: 'html' };
	} catch { /* abaikan */ }
	throw new Error('Tidak ketemu hasilnya, coba kata kunci lain.');
}

/** Download audio mp3 dari videoId, coba tiap client sampai berhasil. */
async function downloadAudio(videoId, tmpDir) {
	const url = `https://www.youtube.com/watch?v=${videoId}`;
	const errors = [];
	for (const client of CLIENTS) {
		try {
			await execFileAsync(
				YTDLP,
				[
					'--no-playlist', '--no-warnings',
					'--extractor-args', `youtube:player_client=${client}`,
					'--retries', '2', '--socket-timeout', '30',
					'--extract-audio', '--audio-format', 'mp3',
					'--audio-quality', '0',
					'-o', path.join(tmpDir, '%(id)s.%(ext)s'),
					url,
				],
				{ timeout: 600000 }
			);
			const files = fs.readdirSync(tmpDir).filter(f => f.endsWith('.mp3'));
			if (!files.length) throw new Error('mp3 tidak terbuat');
			const file = path.join(tmpDir, files[0]);
			if (fs.statSync(file).size < 20 * 1024) throw new Error('file terlalu kecil');
			return file;
		} catch (e) {
			errors.push(`${client}: ${(e.message || '').split('\n')[0]}`);
		}
	}
	throw new Error('Semua client gagal: ' + errors.join(' | ').slice(0, 200));
}

/** Download audio via Neoxr API (server pihak ketiga, bypass block YouTube). */
async function downloadViaNeoxr(query, tmpDir) {
	const apiUrl = `${NEOXR_BASE}/play?q=${encodeURIComponent(query)}&apikey=${NEOXR_APIKEY}`;
	const res = await fetch(apiUrl, {
		headers: { 'User-Agent': UA },
		signal: AbortSignal.timeout(30000),
	});
	if (!res.ok) throw new Error(`Neoxr HTTP ${res.status}`);
	const data = await res.json();
	if (!data?.status || !data?.data?.url) {
		throw new Error('Neoxr: tidak ada URL audio');
	}
	// Cek durasi
	const duration = data.duration_seconds || 0;
	if (duration > MAX_DURATION) {
		throw new Error(`Kepanjangan (${Math.round(duration / 60)} mnt), maksimal 20 menit.`);
	}
	// Download file audio dari URL Neoxr
	const mediaRes = await fetch(data.data.url, {
		headers: { 'User-Agent': UA },
		signal: AbortSignal.timeout(120000),
	});
	if (!mediaRes.ok) throw new Error(`Neoxr download HTTP ${mediaRes.status}`);
	const buffer = Buffer.from(await mediaRes.arrayBuffer());
	if (buffer.length < 20 * 1024) throw new Error('Neoxr: file terlalu kecil');
	const safeTitle = (data.title || 'audio').replace(/[\\/:*?"<>|]/g, '').slice(0, 80) || 'audio';
	const file = path.join(tmpDir, `${safeTitle}.mp3`);
	fs.writeFileSync(file, buffer);
	return { file, title: data.title || query, duration };
}

/**
 * Cari video YouTube pertama dari kata kunci lalu unduh audionya (mp3).
 * Urutan: cache -> Neoxr API -> yt-dlp multi-client.
 * @returns {Promise<{file: string, title: string, duration: number}>}
 */
export async function downloadYouTubeAudio(query) {
	// 0. Cek cache dulu
	const cached = getCached(query);
	if (cached) return { file: cached.file, title: cached.title, duration: 0, cached: true };

	const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'yt-'));
	const errors = [];
	// 1. Coba Neoxr API dulu (paling tahan block)
	try {
		const result = await downloadViaNeoxr(query, tmpDir);
		putCache(query, result.file, result.title);
		return result;
	} catch (e) {
		errors.push(`neoxr: ${(e.message || '').slice(0, 80)}`);
	}
	// 2. Fallback ke yt-dlp multi-client
	try {
		const video = await findVideo(query);
		if (video.duration > MAX_DURATION) {
			throw new Error(`Kepanjangan (${Math.round(video.duration / 60)} mnt), maksimal 20 menit.`);
		}
		const file = await downloadAudio(video.id, tmpDir);
		putCache(query, file, video.title);
		return { file, title: video.title, duration: video.duration };
	} catch (err) {
		fs.rmSync(tmpDir, { recursive: true, force: true });
		errors.push(`ytdlp: ${(err.message || '').slice(0, 80)}`);
		if (/^(Tidak ketemu|Kepanjangan)/.test(err.message)) throw err;
		throw new Error('Gagal mengunduh audio (' + errors.join(' | ').slice(0, 150) + '). Coba lagi atau ganti kata kunci.');
	}
}

export function cleanupYouTubeAudio(filePath) {
	try {
		fs.rmSync(path.dirname(filePath), { recursive: true, force: true });
	} catch { /* abaikan */ }
}
