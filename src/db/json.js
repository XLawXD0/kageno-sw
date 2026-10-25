'use strict';

// Database JSON lokal sederhana (key -> value), disimpan di <dir>/<name>.json
// Dipakai index.js untuk: groups, contacts, settings, statuslog.
//
// API:
//   read(key)          -> value | undefined
//   write(key, value)  -> value   (simpan, di-flush ke disk dengan debounce)
//   has(key) / delete(key) / clear()
//   keys() / values() / entries()   -> iterator
//   find(fn) / filter(fn) / map(fn) -> bekerja atas values
//   length / size

import fs from 'fs';
import path from 'path';

const instances = new Set();
let exitHooked = false;

function hookExit() {
	if (exitHooked) return;
	exitHooked = true;
	const flushAll = () => {
		for (const db of instances) {
			try {
				db.flush();
			} catch {}
		}
	};
	process.on('exit', flushAll);
	for (const sig of ['SIGINT', 'SIGTERM']) {
		process.on(sig, () => {
			flushAll();
			process.exit(0);
		});
	}
}

export default class JSONDB {
	/**
	 * @param {string} name nama file (tanpa .json)
	 * @param {string} dir direktori penyimpanan
	 * @param {number} [delay] jeda debounce simpan (ms)
	 */
	constructor(name, dir = process.cwd(), delay = 500) {
		this.name = name;
		this.dir = dir;
		this.file = path.join(dir, `${name}.json`);
		this.delay = delay;
		/** @type {Map<string, any>} */
		this.data = new Map();
		this._timer = null;
		this._dirty = false;

		this._load();
		instances.add(this);
		hookExit();
	}

	_load() {
		try {
			fs.mkdirSync(this.dir, { recursive: true });
		} catch {}

		if (!fs.existsSync(this.file)) return;

		try {
			const raw = fs.readFileSync(this.file, 'utf8');
			if (!raw.trim()) return;
			const obj = JSON.parse(raw);
			if (obj && typeof obj === 'object') {
				for (const [k, v] of Object.entries(obj)) this.data.set(k, v);
			}
		} catch (e) {
			// file rusak: simpan cadangan, mulai dari kosong
			try {
				fs.renameSync(this.file, `${this.file}.corrupt-${Date.now()}`);
			} catch {}
			console.warn(`[db:${this.name}] file rusak, dimulai dari kosong:`, e?.message || e);
		}
	}

	_schedule() {
		this._dirty = true;
		if (this._timer) return;
		this._timer = setTimeout(() => {
			this._timer = null;
			try {
				this.flush();
			} catch (e) {
				console.error(`[db:${this.name}] gagal menyimpan:`, e?.message || e);
			}
		}, this.delay);
		this._timer.unref?.();
	}

	/** Tulis ke disk sekarang juga (atomic: tulis tmp lalu rename). */
	flush() {
		if (this._timer) {
			clearTimeout(this._timer);
			this._timer = null;
		}
		if (!this._dirty) return;
		this._dirty = false;

		fs.mkdirSync(this.dir, { recursive: true });
		const tmp = `${this.file}.tmp`;
		fs.writeFileSync(tmp, JSON.stringify(Object.fromEntries(this.data)));
		fs.renameSync(tmp, this.file);
	}

	read(key) {
		return this.data.get(key);
	}

	write(key, value) {
		this.data.set(key, value);
		this._schedule();
		return value;
	}

	has(key) {
		return this.data.has(key);
	}

	delete(key) {
		const ok = this.data.delete(key);
		if (ok) this._schedule();
		return ok;
	}

	clear() {
		this.data.clear();
		this._schedule();
	}

	keys() {
		return this.data.keys();
	}

	values() {
		return this.data.values();
	}

	entries() {
		return this.data.entries();
	}

	find(fn) {
		for (const v of this.data.values()) if (fn(v)) return v;
		return undefined;
	}

	filter(fn) {
		return Array.from(this.data.values()).filter(fn);
	}

	map(fn) {
		return Array.from(this.data.values()).map(fn);
	}

	get length() {
		return this.data.size;
	}

	get size() {
		return this.data.size;
	}

	[Symbol.iterator]() {
		return this.data.values();
	}
}
