'use strict';
// Command: fwd — atur channel pengiriman & toggle fitur forward (per-instance).
// Kategori: owner

import fs from 'fs';
import path from 'path';
import { loadForwardCfg, saveForwardCfg } from '../../helper/forward.js';

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

function parseChannel(v) {
	const s = String(v || '').trim().toLowerCase();
	if (['wa', 'tg', 'both', 'off'].includes(s)) return s;
	return null;
}
function isOn(v) { return ['on', '1', 'true', 'nyala', 'ya'].includes(String(v || '').toLowerCase()); }
function isOff(v) { return ['off', '0', 'false', 'mati', 'tidak'].includes(String(v || '').toLowerCase()); }

function chLabel(c) {
	if (c === 'wa') return '🟢 WhatsApp';
	if (c === 'tg') return '🔵 Telegram';
	if (c === 'both') return '🟣 WA + Telegram';
	if (c === 'off') return '⭕ OFF';
	return c;
}

function formatCfg(cfg) {
	const on = v => v ? 'ON ✅' : 'OFF ❌';
	const section = (num, title, enabled, channel) =>
		`*${num}. ${title}:*\n` +
		`   Toggle  : ${on(enabled)}\n` +
		`   Channel : ${chLabel(channel)}\n`;

	return (
		`📡 *PENGATURAN FORWARD*\n\n` +
		section(1, 'Pesan Chat & Grup', cfg.messageEnabled, cfg.messageChannel) + `\n` +
		section(2, 'Status (SW)', cfg.swEnabled, cfg.swChannel) + `\n` +
		section(3, 'Anti-Delete', cfg.antideleteEnabled, cfg.antideleteChannel) + `\n` +
		section(4, 'View-Once (RVO)', cfg.viewonceEnabled, cfg.viewonceChannel) + `\n` +
		section(5, 'Pantauan (Watch)', cfg.watchEnabled, cfg.watchChannel) + `\n` +
		`*━━━ CARA PAKAI ━━━*\n` +
		`\`.fwd <fitur> on|off\`\n` +
		`\`.fwd <fitur>ch wa|tg|both\`\n\n` +
		`*Fitur:* msg, sw, ad, rvo, watch`
	);
}

export default {
	name: 'fwd',
	aliases: ['forward', 'setfwd'],
	category: 'owner',
	desc: 'Toggle channel & on/off forward (WA/TG/both)',
	async run(ctx) {
		const { hisoka, m, query } = ctx;
		const arg = (query || '').trim().toLowerCase();
		const cfg = loadForwardCfg(hisoka);

		if (!arg || arg === 'stat' || arg === 'status' || arg === 'help') {
			await m.reply(formatCfg(cfg));
			return;
		}

		const parts = arg.split(/\s+/);
		const sub = parts[0];
		const val = parts[1] || '';

		const handleToggle = async (key, label) => {
			if (isOn(val)) { saveForwardCfg({ [key]: true }, hisoka); await m.reply(`${label} → *ON ✅*`); return true; }
			if (isOff(val)) { saveForwardCfg({ [key]: false }, hisoka); await m.reply(`${label} → *OFF ❌*`); return true; }
			await m.reply(`Pakai: \`.fwd ${sub} on\` atau \`.fwd ${sub} off\``);
			return true;
		};
		const handleChannel = async (key, label) => {
			const ch = parseChannel(val);
			if (!ch) { await m.reply(`Pakai: \`.fwd ${sub} wa|tg|both\``); return true; }
			saveForwardCfg({ [key]: ch }, hisoka);
			await m.reply(`${label} channel → *${ch.toUpperCase()}*`);
			return true;
		};

		if (sub === 'msg' || sub === 'message') { await handleToggle('messageEnabled', '📡 Pesan chat & grup'); return; }
		if (sub === 'msgch' || sub === 'messagech') { await handleChannel('messageChannel', '📡 Pesan'); return; }
		if (sub === 'sw') { await handleToggle('swEnabled', '👁️ Status (SW)'); return; }
		if (sub === 'swch' || sub === 'swchannel') { await handleChannel('swChannel', '👁️ SW'); return; }
		if (sub === 'ad' || sub === 'antidelete') { await handleToggle('antideleteEnabled', '🗑️ Anti-delete'); return; }
		if (sub === 'adch' || sub === 'adchannel') { await handleChannel('antideleteChannel', '🗑️ Anti-delete'); return; }
		if (sub === 'rvo' || sub === 'viewonce') { await handleToggle('viewonceEnabled', '🔓 View-once'); return; }
		if (sub === 'rvoch' || sub === 'rvochan') { await handleChannel('viewonceChannel', '🔓 RVO'); return; }
		if (sub === 'watch' || sub === 'pantau') { await handleToggle('watchEnabled', '👀 Pantauan'); return; }
		if (sub === 'watchch' || sub === 'pantauch') { await handleChannel('watchChannel', '👀 Pantauan'); return; }

		await m.reply(`❓ Perintah tidak dikenal.\n\n${formatCfg(cfg)}`);
	},
};