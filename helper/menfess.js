'use strict';

// Menfess (anonymous message) & AFK system — port dari Furina MD.

import fs from 'fs';
import path from 'path';

const DATA_DIR = '/home/hatch/workspace/Kageno/data';
const MENFESS_JSON = path.join(DATA_DIR, 'menfess.json');
const AFK_JSON = path.join(DATA_DIR, 'afk.json');

function loadJson(p, fallback) {
	try {
		if (!fs.existsSync(p)) return fallback;
		return JSON.parse(fs.readFileSync(p, 'utf8'));
	} catch { return fallback; }
}
function saveJson(p, data) {
	try {
		fs.mkdirSync(path.dirname(p), { recursive: true });
		fs.writeFileSync(p, JSON.stringify(data, null, 1));
	} catch {}
}

// ===== MENFESS =====
export function getMenfess() { return loadJson(MENFESS_JSON, {}); }
export function saveMenfess(d) { saveJson(MENFESS_JSON, d); }

export function findMenfessSession(menfess, jid) {
	return Object.values(menfess).find(s => s.a === jid || s.b === jid) || null;
}

// ===== AFK =====
export function getAfk() { return loadJson(AFK_JSON, {}); }
export function saveAfk(d) { saveJson(AFK_JSON, d); }

export function setAfk(jid, reason) {
	const afk = getAfk();
	afk[jid] = { time: Date.now(), reason: reason || '-' };
	saveAfk(afk);
}
export function clearAfk(jid) {
	const afk = getAfk();
	if (afk[jid]) { delete afk[jid]; saveAfk(afk); return true; }
	return false;
}
export function checkAfk(jid) { return getAfk()[jid] || null; }

export function fmtDuration(ms) {
	const s = Math.floor(ms / 1000);
	if (s < 60) return `${s} detik`;
	const m = Math.floor(s / 60);
	if (m < 60) return `${m} menit`;
	const h = Math.floor(m / 60);
	if (h < 24) return `${h} jam ${m % 60} menit`;
	return `${Math.floor(h / 24)} hari ${h % 24} jam`;
}
