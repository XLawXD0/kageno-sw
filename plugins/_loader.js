'use strict';

// Plugin loader REKURSIF: scan plugins/<kategori>/*.js (dan plugins/*.js),
// kecuali file diawali "_". Validasi format { name, run } lalu bangun
// map command -> plugin. Dipakai oleh dispatcher di handler/message.js.

import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';

function collectFiles(dir, base = dir) {
	let out = [];
	let entries = [];
	try {
		entries = fs.readdirSync(dir, { withFileTypes: true });
	} catch {
		return out;
	}
	for (const ent of entries.sort((a, b) => a.name.localeCompare(b.name))) {
		const full = path.join(dir, ent.name);
		if (ent.isDirectory()) {
			out = out.concat(collectFiles(full, base));
		} else if (ent.isFile() && ent.name.endsWith('.js') && !ent.name.startsWith('_')) {
			out.push({ full, rel: path.relative(base, full) });
		}
	}
	return out;
}

/**
 * @returns {Promise<{map: Map<string, object>, list: object[]}>}
 */
export async function loadPlugins(pluginsDir) {
	const map = new Map();
	const list = [];
	const files = collectFiles(pluginsDir);
	if (!files.length) {
		console.error('\x1b[31m[plugin] tidak ada file plugin ditemukan di:\x1b[39m', pluginsDir);
		return { map, list };
	}
	for (const { full, rel } of files) {
		try {
			const mod = await import(pathToFileURL(full).href);
			const p = mod.default;
			if (!p || typeof p.name !== 'string' || typeof p.run !== 'function') {
				console.warn(`\x1b[33m[plugin] skip ${rel}: format tidak valid (butuh { name, run })\x1b[39m`);
				continue;
			}
			p.aliases = Array.isArray(p.aliases) ? p.aliases : [];
			p.category = p.category || 'other';
			p.desc = p.desc || '';
			p.file = rel;
			list.push(p);
			for (const alias of [p.name, ...p.aliases]) {
				const key = String(alias).toLowerCase();
				if (map.has(key)) {
					console.warn(`\x1b[33m[plugin] duplikat command "${key}" di ${rel} (sudah ada)\x1b[39m`);
					continue;
				}
				map.set(key, p);
			}
		} catch (e) {
			console.error(`\x1b[31m[plugin] gagal load ${rel}:\x1b[39m`, e?.message || e);
		}
	}
	return { map, list };
}
