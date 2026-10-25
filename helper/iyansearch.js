'use strict';

// Search via iyanapi.vercel.app (API key premium di settings.js)
// + YouTube search langsung via yt-dlp (API iyanapi kena blokir bot YouTube).

import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);
const YTDLP = '/home/hatch/workspace/tiktokbot/venv/bin/yt-dlp';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';

const IYANAPI = 'https://iyanapi.vercel.app';

function apiKey() {
	const k = process.env.IYANAPI_KEY || process.env.TIKTOK_V2_API_KEY;
	if (!k) throw new Error('API key iyanapi belum diset.');
	return k;
}

/**
 * Search sfile.mobi via iyanapi.
 * @returns {Promise<Array<{name, url}>>}
 */
export async function searchSfile(query) {
	const r = await fetch(`${IYANAPI}/api/search/sfile?q=${encodeURIComponent(query)}&apikey=${encodeURIComponent(apiKey())}`, {
		headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(30000),
	});
	if (!r.ok) throw new Error('API search sibuk.');
	const j = await r.json();
	if (!j.status || !j.result?.files?.length) throw new Error(j.message || 'Tidak ada hasil.');
	return j.result.files;
}

/**
 * Search YouTube langsung via yt-dlp (tanpa API).
 * @returns {Promise<Array<{title, url, duration, uploader}>>}
 */
export async function searchYoutube(query, limit = 5) {
	const args = [
		'--no-warnings', '--no-playlist', '--flat-playlist',
		'--extractor-args', 'youtube:player_client=android',
		'--print', '%(title)s\n%(webpage_url)s\n%(duration)s\n%(uploader)s\n---',
		`ytsearch${limit}:${query}`,
	];
	const { stdout } = await execFileAsync(YTDLP, args, { timeout: 60000 });
	const blocks = stdout.split('\n---\n').map(b => b.trim()).filter(Boolean);
	const out = [];
	for (const b of blocks) {
		const [title, url, dur, uploader] = b.split('\n');
		if (!url?.startsWith('http')) continue;
		out.push({ title: title || '-', url, duration: parseInt(dur) || 0, uploader: uploader || '-' });
	}
	if (!out.length) throw new Error('Tidak ada hasil YouTube.');
	return out;
}

export function fmtDur(sec) {
	if (!sec) return '-';
	const m = Math.floor(sec / 60), s = sec % 60;
	return `${m}:${String(s).padStart(2, '0')}`;
}
