'use strict';

import fs from 'fs';
import path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { dataDirPath, rootPath } from './paths.js';

const execFileAsync = promisify(execFile);
const YTDLP = process.env.YTDLP_PATH || '/home/hatch/workspace/tiktokbot/venv/bin/yt-dlp';

const DEFAULTS = {
	enabled: false,
	times: ['07:00', '12:00', '18:00'],
	queue: [],
	index: 0,
	caption: '',
	posted: {},
	lastError: '',
};

function wibNow() {
	const f = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit', hour12: false });
	return f.format(new Date());
}
function wibDate() {
	const f = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' });
	return f.format(new Date());
}

function getCfgPath(hisoka) { return dataDirPath(hisoka, 'schedstory.json'); }
function getDlDir(hisoka) { return rootPath(hisoka, 'downloads/schedstory'); }

export function loadStoryCfg(hisoka = null) {
	const file = getCfgPath(hisoka);
	try {
		if (!fs.existsSync(file)) {
			fs.mkdirSync(path.dirname(file), { recursive: true });
			fs.writeFileSync(file, JSON.stringify(DEFAULTS, null, 2));
			return { ...DEFAULTS };
		}
		const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
		return { ...DEFAULTS, ...raw };
	} catch {
		return { ...DEFAULTS };
	}
}

export function saveStoryCfg(cfg, hisoka = null) {
	try {
		const file = getCfgPath(hisoka);
		fs.mkdirSync(path.dirname(file), { recursive: true });
		fs.writeFileSync(file, JSON.stringify(cfg, null, 2));
	} catch (e) {
		console.error('Gagal simpan schedstory:', e?.message || e);
	}
}

export async function downloadTikTokHD(url, hisoka = null) {
	const DL_DIR = getDlDir(hisoka);
	if (!fs.existsSync(DL_DIR)) fs.mkdirSync(DL_DIR, { recursive: true });
	const outTpl = path.join(DL_DIR, '%(id)s.%(ext)s');
	const args = [
		'--no-warnings', '--no-playlist',
		'--extractor-args', 'tiktok:api_hostname=api16-normal-c-useast1a.tiktokv.us',
		'-f', 'best[ext=mp4]/best/bestvideo+bestaudio',
		'--merge-output-format', 'mp4',
		'--print', '%(id)s\n%(title)s\n%(uploader)s',
		'-o', outTpl,
		url,
	];
	const { stdout } = await execFileAsync(YTDLP, args, { timeout: 180000, maxBuffer: 16 * 1024 * 1024 });
	const lines = stdout.trim().split('\n');
	const [id, title, uploader] = lines;
	const files = fs.readdirSync(DL_DIR).filter(f => f.startsWith(id + '.'));
	if (!files.length) throw new Error('File hasil download tidak ketemu.');
	const file = path.join(DL_DIR, files[0]);
	const stat = fs.statSync(file);
	if (stat.size < 50 * 1024) throw new Error('File terlalu kecil, kemungkinan gagal.');
	return { file, title: (title || '').slice(0, 150), uploader: uploader || 'TikTok', size: stat.size };
}

export async function postToStatus(sock, filePath, caption) {
	const stat = fs.statSync(filePath);
	if (stat.size > 100 * 1024 * 1024) throw new Error('Video >100MB, kebesaran untuk status.');
	await sock.sendMessage('status@broadcast', {
		video: fs.readFileSync(filePath),
		caption: caption || '',
		mimetype: 'video/mp4',
	});
}

function nextItem(cfg) {
	if (!cfg.queue.length) return null;
	const item = cfg.queue[cfg.index % cfg.queue.length];
	cfg.index = (cfg.index + 1) % cfg.queue.length;
	return item;
}

export async function storyTick(sock) {
	// Dipakai dari index.js tiap 60 detik — pakai hisoka yang di-pass
	const hisoka = sock;
	const cfg = loadStoryCfg(hisoka);
	if (!cfg.enabled || !cfg.times.length || !cfg.queue.length) return;
	const now = wibNow();
	if (!cfg.times.includes(now)) return;
	const today = wibDate();
	cfg.posted[today] = cfg.posted[today] || [];
	if (cfg.posted[today].includes(now)) return;

	const item = nextItem(cfg);
	if (!item) return;
	try {
		console.info(`\x1b[36m[story] Posting terjadwal ${now} WIB: ${item.url}\x1b[39m`);
		const dl = await downloadTikTokHD(item.url, hisoka);
		const caption = cfg.caption || `🎬 ${dl.title}\n👤 @${dl.uploader}`;
		await postToStatus(hisoka, dl.file, caption);
		cfg.posted[today].push(now);
		cfg.lastError = '';
		console.info('\x1b[32m[story] Status terkirim.\x1b[39m');
		try { fs.unlinkSync(dl.file); } catch {}
		for (const d of Object.keys(cfg.posted)) {
			if (d < today) {
				const diff = (new Date(today) - new Date(d)) / 86400000;
				if (diff > 7) delete cfg.posted[d];
			}
		}
	} catch (e) {
		cfg.lastError = `${now}: ${e?.message || e}`;
		console.error('\x1b[31m[story] Gagal posting:\x1b[39m', cfg.lastError);
	}
	saveStoryCfg(cfg, hisoka);
}
