'use strict';
// Helper terpusat untuk ScrLxrd REST API (api.scrlxrd.pp.ua).
// API key dibaca dari env SCRLXRD_API_KEY — JANGAN hardcode di kode.
// Base URL bisa dioverride via env SCRLXRD_API_BASE.

const BASE = (process.env.SCRLXRD_API_BASE || 'https://api.scrlxrd.pp.ua').replace(/\/+$/, '');

export function getApiKey() {
	return (process.env.SCRLXRD_API_KEY || '').trim();
}

/**
 * GET JSON ke API. Otomatis sertakan apikey (query param + header).
 * @param {string} apiPath mis. '/api/downloader/tiktok'
 * @param {object} params query params tambahan
 */
export async function apiGet(apiPath, params = {}) {
	const key = getApiKey();
	if (!key) throw new Error('SCRLXRD_API_KEY belum diset di settings.js');
	const qs = new URLSearchParams({ apikey: key });
	for (const [k, v] of Object.entries(params)) {
		if (v !== undefined && v !== null && v !== '') qs.append(k, String(v));
	}
	const url = `${BASE}${apiPath}?${qs.toString()}`;
	const ctrl = new AbortController();
	const to = setTimeout(() => ctrl.abort(), 90000);
	try {
		const res = await fetch(url, {
			signal: ctrl.signal,
			headers: { 'X-Api-Key': key, 'User-Agent': 'swbot/1.0' },
		});
		const json = await res.json().catch(() => ({}));
		if (json && json.status === false) {
			throw new Error(json.error || json.message || 'API mengembalikan status false');
		}
		return json;
	} finally {
		clearTimeout(to);
	}
}

/** Ambil nested path dari object: 'result.video' -> obj.result.video */
function pickPath(obj, path) {
	return String(path).split('.').reduce(
		(o, k) => (o && typeof o === 'object' ? o[k] : undefined), obj);
}

/** Normalisasi satu nilai jadi URL string (atau null). */
function asUrl(v) {
	if (typeof v === 'string' && /^https?:\/\//i.test(v.trim())) return v.trim();
	if (v && typeof v === 'object' && typeof v.url === 'string' && /^https?:\/\//i.test(v.url)) return v.url.trim();
	return null;
}

/**
 * Cari URL media dari respons API yang bentuknya bisa bervariasi.
 * @param {object} json respons API
 * @param {'video'|'audio'|'image'|'any'} kind jenis media yang dicari
 * @returns {string|null} URL atau null bila tidak ketemu
 */
export function pickMediaUrl(json, kind = 'any') {
	if (!json || typeof json !== 'object') return null;
	const videoPaths = ['result.video', 'result.nowm', 'result.no_watermark', 'result.play', 'data.video', 'data.play', 'result.url', 'data.url', 'video', 'url', 'result.download', 'data.download', 'download', 'link', 'result.link'];
	const audioPaths = ['result.audio', 'result.music', 'data.audio', 'data.music', 'result.url', 'data.url', 'audio', 'music', 'url', 'result.download', 'data.download', 'download'];
	const imagePaths = ['result.image', 'result.photo', 'data.image', 'result.url', 'data.url', 'image', 'photo', 'url', 'result.download', 'data.download'];
	const anyPaths = [...new Set([...videoPaths, ...audioPaths, ...imagePaths])];
	const paths = kind === 'video' ? videoPaths : kind === 'audio' ? audioPaths : kind === 'image' ? imagePaths : anyPaths;
	for (const p of paths) {
		const v = pickPath(json, p);
		if (Array.isArray(v)) {
			for (const item of v) {
				const u = asUrl(item);
				if (u) return u;
			}
		} else {
			const u = asUrl(v);
			if (u) return u;
		}
	}
	return null;
}

/** Ambil info teks umum (judul/author) dari respons. */
export function pickMeta(json) {
	if (!json || typeof json !== 'object') return {};
	const r = json.result && typeof json.result === 'object' ? json.result : {};
	const d = json.data && typeof json.data === 'object' ? json.data : {};
	const val = (...paths) => {
		for (const p of paths) {
			const v = pickPath(json, p) ?? pickPath(r, p.replace(/^(result|data)\./, '')) ?? pickPath(d, p.replace(/^(result|data)\./, ''));
			if (typeof v === 'string' && v.trim()) return v.trim();
		}
		return '';
	};
	return {
		title: val('result.title', 'data.title', 'title', 'result.desc', 'data.desc'),
		author: val('result.author', 'data.author', 'author', 'result.username', 'data.username'),
		duration: val('result.duration', 'data.duration', 'duration'),
	};
}

/**
 * Download URL jadi Buffer (dengan batas ukuran).
 * @returns {Promise<Buffer>}
 */
export async function downloadBuffer(url, maxMB = 100, timeoutMs = 90000) {
	const ctrl = new AbortController();
	const to = setTimeout(() => ctrl.abort(), timeoutMs);
	try {
		const res = await fetch(url, {
			signal: ctrl.signal,
			headers: { 'User-Agent': 'Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36' },
		});
		if (!res.ok) throw new Error(`HTTP ${res.status} saat mengunduh media`);
		const ab = await res.arrayBuffer();
		const buf = Buffer.from(ab);
		if (buf.length > maxMB * 1024 * 1024) {
			throw new Error(`Ukuran file melebihi ${maxMB}MB`);
		}
		if (!buf.length) throw new Error('File kosong');
		return buf;
	} finally {
		clearTimeout(to);
	}
}

/**
 * GET ke endpoint yang mengembalikan media LANGSUNG (binary) atau JSON berisi URL media.
 * Dipakai untuk maker seperti brat/bratvid.
 * @returns {Promise<Buffer>}
 */
export async function apiMediaBuffer(apiPath, params = {}, maxMB = 20) {
	const key = getApiKey();
	if (!key) throw new Error('SCRLXRD_API_KEY belum diset di settings.js');
	const qs = new URLSearchParams({ apikey: key });
	for (const [k, v] of Object.entries(params)) {
		if (v !== undefined && v !== null && v !== '') qs.append(k, String(v));
	}
	const url = `${BASE}${apiPath}?${qs.toString()}`;
	const ctrl = new AbortController();
	const to = setTimeout(() => ctrl.abort(), 120000);
	try {
		const res = await fetch(url, {
			signal: ctrl.signal,
			headers: { 'X-Api-Key': key, 'User-Agent': 'swbot/1.0' },
		});
		const ct = res.headers.get('content-type') || '';
		if (ct.includes('application/json')) {
			const json = await res.json().catch(() => ({}));
			if (json && json.status === false) {
				throw new Error(json.error || json.message || 'API mengembalikan status false');
			}
			const mediaUrl = pickMediaUrl(json, 'any');
			if (!mediaUrl) throw new Error('Media tidak ditemukan di respons API. ' + debugKeys(json));
			return downloadBuffer(mediaUrl, maxMB);
		}
		if (!res.ok) throw new Error(`HTTP ${res.status} dari API`);
		const buf = Buffer.from(await res.arrayBuffer());
		if (!buf.length) throw new Error('File kosong dari API');
		if (buf.length > maxMB * 1024 * 1024) throw new Error(`Ukuran file melebihi ${maxMB}MB`);
		return buf;
	} finally {
		clearTimeout(to);
	}
}

/** Kunci top-level respons untuk debug bila parsing gagal. */
export function debugKeys(json) {
	try {
		const keys = v => (v && typeof v === 'object' ? Object.keys(v).slice(0, 12).join(',') : typeof v);
		return `top:[${keys(json)}] result:[${keys(json?.result)}]`;
	} catch { return '?'; }
}

/**
 * Upload Buffer (gambar/file) ke API via multipart/form-data.
 * @param {string} apiPath mis. '/api/tools/upload'
 * @param {Buffer} buffer isi file
 * @param {string} filename nama file, mis. 'hd-123.jpg'
 * @returns {Promise<string>} URL publik hasil upload
 */
export async function apiUploadBuffer(apiPath, buffer, filename = 'upload.jpg') {
	const key = getApiKey();
	if (!key) throw new Error('SCRLXRD_API_KEY belum diset di settings.js');
	if (!buffer || !buffer.length) throw new Error('Buffer kosong, tidak bisa diupload');
	const qs = new URLSearchParams({ apikey: key });
	const url = `${BASE}${apiPath}?${qs.toString()}`;
	const mime = /\.png$/i.test(filename) ? 'image/png'
		: /\.webp$/i.test(filename) ? 'image/webp'
		: /\.gif$/i.test(filename) ? 'image/gif'
		: 'image/jpeg';
	const fd = new FormData();
	fd.append('file', new Blob([buffer], { type: mime }), filename);
	const ctrl = new AbortController();
	const to = setTimeout(() => ctrl.abort(), 120000);
	try {
		const res = await fetch(url, {
			method: 'POST',
			signal: ctrl.signal,
			headers: { 'X-Api-Key': key, 'User-Agent': 'swbot/1.0' },
			body: fd,
		});
		const json = await res.json().catch(() => ({}));
		if (json && json.status === false) {
			throw new Error(json.error || json.message || 'Upload gagal (API status false)');
		}
		const fileUrl = pickMediaUrl(json, 'image') || pickMediaUrl(json, 'any');
		if (!fileUrl) throw new Error('URL hasil upload tidak ditemukan di respons API. ' + debugKeys(json));
		return fileUrl;
	} finally {
		clearTimeout(to);
	}
}
