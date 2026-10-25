'use strict';
// Konfigurasi channel per-instance (bot utama vs jadibot).

import fs from 'fs';
import path from 'path';
import { dataDirPath, isCloneCtx } from './paths.js';

const DEFAULTS = {
	messageEnabled: true,
	messageChannel: 'tg',
	swEnabled: true,
	swChannel: 'tg',
	antideleteEnabled: true,
	antideleteChannel: 'tg',
	viewonceEnabled: true,
	viewonceChannel: 'tg',
	watchEnabled: true,
	watchChannel: 'tg',
};

const _cache = new Map();

function getCfgFile(hisoka) {
	return dataDirPath(hisoka, 'forward.json');
}

export function loadForwardCfg(hisoka = null) {
	const file = getCfgFile(hisoka);
	try {
		const stat = fs.statSync(file);
		const cached = _cache.get(file);
		if (cached && cached.mtime === stat.mtimeMs) return cached.data;
		const raw = JSON.parse(fs.readFileSync(file, 'utf-8') || '{}');
		const data = { ...DEFAULTS, ...raw };
		_cache.set(file, { data, mtime: stat.mtimeMs });
		return data;
	} catch {
		return { ...DEFAULTS };
	}
}

export function saveForwardCfg(patch, hisoka = null) {
	const file = getCfgFile(hisoka);
	const cur = loadForwardCfg(hisoka);
	const next = { ...cur, ...patch };
	try {
		fs.mkdirSync(path.dirname(file), { recursive: true });
		fs.writeFileSync(file, JSON.stringify(next, null, 2) + '\n');
	} catch (e) {
		console.error('[fwd] gagal simpan:', e?.message || e);
	}
	_cache.delete(file);
	return next;
}

export function channelHas(channel, want) {
	if (!channel) return false;
	const c = String(channel).toLowerCase();
	if (c === 'both') return true;
	if (c === 'off') return false;
	return c === want;
}

export function getOwnerJid(hisoka = null) {
	if (isCloneCtx(hisoka)) {
		const num = hisoka._cloneNumber || (hisoka.user?.id || '').split('@')[0];
		if (num) return `${num}@s.whatsapp.net`;
	}
	const owners = (process.env.BOT_NUMBER_OWNER || '').split(',').map(x => x.trim()).filter(Boolean);
	if (!owners.length) return null;
	const clean = owners[0].replace(/[^0-9]/g, '');
	return clean ? `${clean}@s.whatsapp.net` : null;
}

export async function sendToOwnerWA(hisoka, content) {
	const jid = getOwnerJid(hisoka);
	if (!jid) return false;
	try {
		await hisoka.sendMessage(jid, content);
		return true;
	} catch (e) {
		console.error('[fwd] WA gagal:', e?.message || e);
		return false;
	}
}