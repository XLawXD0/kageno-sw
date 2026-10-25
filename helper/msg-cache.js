'use strict';
// Arsip pesan/status ke disk untuk antidelete (TTL 24 jam, maks 2000 entri / 500 MB).
// Dipakai forwardAntidelete agar pesan/status yang dihapus tetap terkirim
// dengan isi aslinya, meski cache memori sudah hilang.

import fs from 'fs';
import path from 'path';
import { getDataDir } from './paths.js';

const MAX_ENTRIES = 2000;
const MAX_TOTAL_BYTES = 500 * 1024 * 1024;
const TTL_MS = 24 * 3600 * 1000;
const MAX_MEDIA_BYTES = 50 * 1024 * 1024;

function cacheDir(hisoka) {
	const d = path.join(getDataDir(hisoka), 'msg-cache');
	try { fs.mkdirSync(d, { recursive: true }); } catch {}
	return d;
}

function safeId(id) {
	return String(id || '').replace(/[^A-Za-z0-9_-]/g, '_');
}

function prune(dir) {
	try {
		const metas = fs.readdirSync(dir).filter(f => f.endsWith('.json')).map(f => {
			try {
				const full = path.join(dir, f);
				const meta = JSON.parse(fs.readFileSync(full, 'utf-8'));
				let size = 0;
				try { size = fs.statSync(full).size; } catch {}
				if (meta.mediaFile) {
					try { size += fs.statSync(path.join(dir, meta.mediaFile)).size; } catch {}
				}
				return { file: full, base: f.slice(0, -5), savedAt: meta.savedAt || 0, mediaFile: meta.mediaFile || null, size };
			} catch {
				return null;
			}
		}).filter(Boolean).sort((a, b) => a.savedAt - b.savedAt);
		let total = metas.reduce((s, m) => s + m.size, 0);
		for (let i = 0; i < metas.length; i++) {
			const m = metas[i];
			const expired = Date.now() - m.savedAt > TTL_MS;
			const overCap = metas.length - i > MAX_ENTRIES || total > MAX_TOTAL_BYTES;
			if (!expired && !overCap) continue;
			try { fs.unlinkSync(m.file); } catch {}
			if (m.mediaFile) {
				try { fs.unlinkSync(path.join(dir, m.mediaFile)); } catch {}
			}
			total -= m.size;
		}
	} catch {}
}

export function saveMessage(hisoka, { id, senderNum, name, when, text, media, mediaType, chat, chatName, isGroup }) {
	try {
		if (!id) return;
		const dir = cacheDir(hisoka);
		const base = safeId(id);
		let mediaFile = null;
		if (media && media.length && media.length <= MAX_MEDIA_BYTES) {
			const ext = { image: 'jpg', video: 'mp4', audio: 'ogg', sticker: 'webp' }[mediaType] || 'bin';
			mediaFile = `${base}.${ext}`;
			fs.writeFileSync(path.join(dir, mediaFile), media);
		}
		fs.writeFileSync(path.join(dir, `${base}.json`), JSON.stringify({
			id: String(id),
			senderNum: senderNum || '',
			name: name || '',
			when: when || '',
			text: text || '',
			mediaFile,
			mediaType: mediaType || '',
			chat: chat || '',
			chatName: chatName || '',
			isGroup: !!isGroup,
			savedAt: Date.now(),
		}));
		prune(dir);
	} catch (e) {
		console.error('[msg-cache] simpan gagal:', e?.message || e);
	}
}

export function loadMessage(hisoka, id) {
	try {
		if (!id) return null;
		const base = safeId(id);
		for (const dir of [cacheDir(hisoka), path.join(getDataDir(hisoka), 'status-cache')]) {
			try {
				const meta = JSON.parse(fs.readFileSync(path.join(dir, `${base}.json`), 'utf-8'));
				if (Date.now() - (meta.savedAt || 0) > TTL_MS) continue;
				let media = null;
				if (meta.mediaFile) {
					try { media = fs.readFileSync(path.join(dir, meta.mediaFile)); } catch {}
				}
				return { ...meta, media };
			} catch {}
		}
		return null;
	} catch {
		return null;
	}
}
