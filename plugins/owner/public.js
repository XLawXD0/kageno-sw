'use strict';
// Command: public — atur mode public / self (private) per bot instance (bot utama atau jadibot).

import fs from 'fs';
import path from 'path';
import { isCloneCtx } from '../../helper/paths.js';
import { jadibotSessionDir, getJadibotByNumber } from '../../helper/jadibot.js';
import { loadConfig, saveConfig } from '../../helper/publicmode.js';

const cleanNum = n => String(n).replace(/[^0-9]/g, '');

export default {
	name: 'public',
	aliases: ['mode', 'publicmode', 'selfmode'],
	category: 'owner',
	// Boleh dijalankan oleh owner nomor jadibot (bukan cuma owner utama).
	// Dispatcher mengecek via isJadibotOwnerSender; plugin tetap verifikasi detail.
	allowJadibotOwner: true,
	desc: 'Atur mode public / self (private) dan whitelist command bot',
	async run(ctx) {
		const { hisoka, m, query } = ctx;
		const arg = (query || '').trim();
		const parts = arg ? arg.split(/\s+/) : [];

		let first = cleanNum(parts[0] || '');
		let isNum = first.length >= 10;
		let num = '';
		let actionParts = [];

		if (isCloneCtx(hisoka)) {
			const cloneNum = cleanNum(hisoka._cloneNumber || hisoka.user?.id || '');
			if (isNum && first !== cloneNum && !m.isOwner) {
				const found = getJadibotByNumber(first);
				let ownerJid = found?.ownerJid;
				if (!ownerJid) {
					try { ownerJid = fs.readFileSync(path.join(jadibotSessionDir(first), '.owner'), 'utf-8').trim(); } catch {}
				}
				if (ownerJid !== m.sender && !m.isOwner) {
					await m.reply('❌ Itu bukan jadibot milikmu.');
					return;
				}
				num = first;
				actionParts = parts.slice(1);
			} else {
				num = cloneNum;
				actionParts = parts;
				if (isNum && first === cloneNum) {
					actionParts = parts.slice(1);
				}
			}
		} else {
			if (isNum) {
				let authorized = m.isOwner;
				if (!authorized) {
					const found = getJadibotByNumber(first);
					let ownerJid = found?.ownerJid;
					if (!ownerJid) {
						try { ownerJid = fs.readFileSync(path.join(jadibotSessionDir(first), '.owner'), 'utf-8').trim(); } catch {}
					}
					if (ownerJid === m.sender) authorized = true;
				}
				if (!authorized) {
					await m.reply('❌ Itu bukan jadibot milikmu.');
					return;
				}
				num = first;
				actionParts = parts.slice(1);
			} else {
				if (!m.isOwner) {
					await m.reply('❌ Pengaturan bot utama khusus owner. Untuk jadibot gunakan: `.public <nomor> on|off`');
					return;
				}
				num = '';
				actionParts = parts;
			}
		}

		const sessionDir = num ? jadibotSessionDir(num) : process.cwd();
		try { fs.mkdirSync(sessionDir, { recursive: true }); } catch {}
		const fakeHisoka = num ? { isJadibot: true, _isClone: true, _cloneNumber: num, _dataDir: sessionDir } : { isJadibot: false, _isClone: false };
		const cfg = loadConfig(fakeHisoka);

		const label = num ? `Jadibot ${num}` : `Bot Utama`;
		const help =
			`🌐 *PUBLIC / SELF MODE CONFIG — ${label}*\n\n` +
			`Status    : ${cfg.enabled ? 'PUBLIK ✅' : 'SELF (PRIVATE) ❌'}\n` +
			`Whitelist : \`${(cfg.whitelist || []).join(', ')}\`\n` +
			`Rate Limit: ${cfg.ratelimit_per_hour || 10} / jam\n\n` +
			`*Cara Pakai:*\n` +
			(num ? `• \`.public ${num} on\` — Aktifkan mode publik\n` : `• \`.public on\` — Aktifkan mode publik\n`) +
			(num ? `• \`.public ${num} off\` — Matikan mode publik (self)\n` : `• \`.public off\` — Matikan mode publik (self)\n`) +
			(num ? `• \`.public ${num} whitelist menu ping s\` — Atur command\n` : `• \`.public whitelist menu ping s\` — Atur command\n`);

		const sub = (actionParts[0] || '').toLowerCase();

		if (!sub || sub === 'status' || sub === 'list') {
			await m.reply(help);
			return;
		}

		if (sub === 'on' || sub === 'off') {
			const enabled = sub === 'on';
			saveConfig(fakeHisoka, { enabled });
			await m.reply(`✅ Mode bot untuk *${label}* berhasil diubah ke: *${enabled ? 'PUBLIK ✅' : 'SELF (PRIVATE) ❌'}*`);
			return;
		}

		if (sub === 'whitelist' || sub === 'set') {
			const whitelist = actionParts.slice(1).map(c => c.replace(/^\./, '').trim()).filter(Boolean);
			if (!whitelist.length) {
				await m.reply(`❌ Masukkan minimal 1 command whitelist.\nContoh: \`.public ${num ? num + ' ' : ''}whitelist menu ping help sticker s\``);
				return;
			}
			saveConfig(fakeHisoka, { whitelist });
			await m.reply(`✅ Whitelist command publik untuk *${label}* diperbarui:\n\`${whitelist.join(', ')}\``);
			return;
		}

		if (sub === 'rate' || sub === 'ratelimit') {
			const numRate = parseInt(actionParts[1], 10);
			if (isNaN(numRate) || numRate <= 0) {
				await m.reply('❌ Masukkan angka rate limit per jam yang valid.\nContoh: `.public rate 15`');
				return;
			}
			saveConfig(fakeHisoka, { ratelimit_per_hour: numRate });
			await m.reply(`✅ Rate limit publik untuk *${label}* diset ke *${numRate}* request / jam.`);
			return;
		}

		await m.reply(help);
	},
};
