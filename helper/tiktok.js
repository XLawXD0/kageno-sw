'use strict';

import { execFile } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import os from 'os';

const execFileAsync = promisify(execFile);

// yt-dlp sebagai fallback
const YTDLP = '/home/hatch/workspace/tiktokbot/venv/bin/yt-dlp';

// ===== SCRAPER via tikwm.com (gratis, tanpa API key) =====
const TIKWM_API = 'https://www.tikwm.com/api/';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';

async function resolveUrl(url) {
	try {
		const r = await fetch(url, { headers: { 'User-Agent': UA }, redirect: 'follow', signal: AbortSignal.timeout(15000) });
		return r.url || url;
	} catch { return url; }
}

/**
 * Ambil info TikTok: video HD (no watermark) atau foto slideshow.
 * @returns {Promise<{type:'video'|'images', title, author, videoUrl?, images?, music?, duration?}>}
 */
export async function getTikTok(rawUrl) {
	let url = rawUrl.trim();
	if (!/tiktok\.com/i.test(url)) throw new Error('Bukan link TikTok.');
	if (/v[mt]\.tiktok\.com/i.test(url)) url = await resolveUrl(url);

	const r = await fetch(TIKWM_API + '?url=' + encodeURIComponent(url), {
		headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(30000),
	});
	if (!r.ok) throw new Error('API TikTok sibuk.');
	const j = await r.json();
	if (j.code !== 0 || !j.data) throw new Error(j.msg || 'Gagal mengambil data TikTok.');

	const d = j.data;
	const author = d.author?.nickname || d.author?.unique_id || 'TikTok';
	const title = (d.title || '').slice(0, 200);
	const music = d.music || d.music_info?.play || null;

	if (Array.isArray(d.images) && d.images.length) {
		return { type: 'images', title, author, images: d.images, music, count: d.images.length };
	}
	const videoUrl = d.hdplay || d.play || d.wmplay;
	if (!videoUrl) throw new Error('URL video tidak ditemukan.');
	return { type: 'video', title, author, videoUrl, music, duration: d.duration };
}

export async function downloadUrl(url, maxMB = 100) {	const r = await fetch(url, {
		headers: { 'User-Agent': UA, 'Referer': 'https://www.tiktok.com/' },
		signal: AbortSignal.timeout(120000),
	});
	if (!r.ok) throw new Error('Download gagal (HTTP ' + r.status + ').');
	const buf = Buffer.from(await r.arrayBuffer());
	if (buf.length > maxMB * 1024 * 1024) throw new Error('File kebesaran (> ' + maxMB + 'MB).');
	return buf;
}

// ===== FALLBACK yt-dlp (kalau tikwm gagal) =====
export function cleanupTikTok(file) {
	try {
		if (!file) return;
		const dir = path.dirname(file);
		if (dir.startsWith(os.tmpdir()) && /tt-/.test(dir)) {
			fs.rmSync(dir, { recursive: true, force: true });
		} else {
			fs.unlinkSync(file);
		}
	} catch {}
}

export async function downloadTikTok(url) {
	const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tt-'));
	try {
		const args = [
			'--no-playlist', '--retries', '3', '--socket-timeout', '30',
			'-f', 'bv*+ba/b',
			'--merge-output-format', 'mp4',
			'-o', path.join(tmpDir, 'video.%(ext)s'),
			url,
		];
		await execFileAsync(YTDLP, args, { timeout: 300000 });
		const files = fs.readdirSync(tmpDir).filter(f => /\.(mp4|mov|webm)$/i.test(f));
		if (!files.length) throw new Error('yt-dlp tidak menghasilkan file.');
		const out = path.join(tmpDir, 'tiktok_hd.mp4');
		fs.renameSync(path.join(tmpDir, files[0]), out);
		return out;
	} catch (err) {
		try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
		throw err;
	}
}
