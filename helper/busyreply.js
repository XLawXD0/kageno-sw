'use strict';
// Auto-reply "sibuk" per-instance.

import fs from 'fs';
import path from 'path';
import { dataDirPath } from './paths.js';

const DEFAULTS = { enabled: true, counts: {} };

function wibDate() {
	return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date());
}

function getCfgFile(hisoka) {
	return dataDirPath(hisoka, 'busyreply.json');
}

export function loadBusyCfg(hisoka = null) {
	const file = getCfgFile(hisoka);
	try {
		if (!fs.existsSync(file)) {
			fs.mkdirSync(path.dirname(file), { recursive: true });
			fs.writeFileSync(file, JSON.stringify(DEFAULTS, null, 2));
			return { ...DEFAULTS };
		}
		return { ...DEFAULTS, ...JSON.parse(fs.readFileSync(file, 'utf8')) };
	} catch {
		return { ...DEFAULTS };
	}
}

export function saveBusyCfg(cfg, hisoka = null) {
	try {
		const file = getCfgFile(hisoka);
		fs.mkdirSync(path.dirname(file), { recursive: true });
		fs.writeFileSync(file, JSON.stringify(cfg, null, 2));
	} catch (e) {
		console.error('Gagal simpan busyreply:', e?.message || e);
	}
}

const PANTUN_GA_ON = [
	'🪁 *Main layangan putus benangnya*\n*Layangannya jatuh ke kali*\n*Aku lagi nggak pegang HP-nya*\n*Nanti kubalas, jangan sebel hati* 😄',
	'🍜 *Pergi ke warung beli mie ayam*\n*Pulangnya mampir beli es teh*\n*Maaf ya aku lagi nggak on*\n*Chat kamu pasti kubalas deh* ✨',
	'🐦 *Burung nuri terbang ke awan*\n*Hinggap sebentar di pohon jati*\n*HP-ku lagi ditinggal tuan*\n*Sabar ya, nanti pasti dibalas lagi* 🙏',
];

export function busyReplyFor(count) {
	if (count === 1) return 'Maaf, mungkin orangnya lagi sibuk 🙏\nIni pesan otomatis dari *AI pribadi* 🤖';
	if (count === 2 || count === 3) return PANTUN_GA_ON[(count - 2) % PANTUN_GA_ON.length];
	return null;
}

export async function handleBusyReply(m, hisoka) {
	if (m.isOwner || m.key?.fromMe || !m.isPrivate || m.status || m.isBot || !m.text) return false;
	const cfg = loadBusyCfg(hisoka);
	if (!cfg.enabled) return false;
	const today = wibDate();
	const sender = m.sender;
	let entry = cfg.counts[sender];
	if (!entry || entry.date !== today) entry = { count: 0, date: today };
	entry.count += 1;
	cfg.counts[sender] = entry;
	for (const jid of Object.keys(cfg.counts)) {
		if (cfg.counts[jid].date !== today) {
			const diff = (new Date(today) - new Date(cfg.counts[jid].date)) / 86400000;
			if (diff > 2) delete cfg.counts[jid];
		}
	}
	saveBusyCfg(cfg, hisoka);
	const reply = busyReplyFor(entry.count);
	if (!reply) return false;
	try { await m.reply(reply); } catch (e) { console.error('Busyreply gagal:', e?.message || e); }
	return true;
}
