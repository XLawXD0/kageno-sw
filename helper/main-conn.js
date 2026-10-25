'use strict';
// Shared state untuk koneksi WA utama.
// Dipakai agar modul lain bisa mengecek status koneksi WA utama
// tanpa circular import.

let _conn = null;
let _connecting = false;
let _onReadyCallbacks = [];

export function getMainConn() { return _conn; }

export function setMainConn(c) {
	_conn = c;
	if (c) {
		const cbs = _onReadyCallbacks;
		_onReadyCallbacks = [];
		for (const cb of cbs) {
			try { cb(c); } catch (e) { console.error('[main-conn] onReady error:', e?.message || e); }
		}
	}
}

export function isMainConnected() {
	try { return !!(_conn && _conn.user); } catch { return !!_conn; }
}

export function isMainConnecting() { return _connecting; }
export function setMainConnecting(v) { _connecting = !!v; }

/** Daftarkan callback yang dipanggil sekali saat WA utama connect. */
export function onMainReady(cb) {
	if (isMainConnected()) { try { cb(_conn); } catch {} return; }
	_onReadyCallbacks.push(cb);
}
