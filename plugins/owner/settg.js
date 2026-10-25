'use strict';
// Command: settg — set Telegram config per-instance (bot utama atau jadibot).

import fs from 'fs';
import path from 'path';
import { isCloneCtx, getTelegramCfg } from '../../helper/paths.js';
import { jadibotSessionDir, getJadibotByNumber } from '../../helper/jadibot.js';

const cleanNum = n => String(n).replace(/[^0-9]/g, '');

export default {
	name: 'settg',
	aliases: ['settelegram', 'tgset'],
	category: 'owner',
	// Boleh dijalankan oleh owner nomor jadibot (bukan cuma owner utama).
	// Dispatcher mengecek via isJadibotOwnerSender; plugin tetap verifikasi detail.
	allowJadibotOwner: true,
	desc: 'Set Telegram chat ID & token (bot utama / jadibot)',
	async run(ctx) {
		const { hisoka, m, query } = ctx;
		const arg = (query || '').trim();
		const parts = arg ? arg.split(/\s+/) : [];

		let first = cleanNum(parts[0] || '');
		// Ambigu: argumen pertama berupa angka bisa berarti nomor jadibot
		// ATAU chatId Telegram (ID pribadi 10 digit / grup -100...). Bedakan
		// dari jumlah argumen: tepat 2 argumen dan yang kedua bukan kata
		// kunci (test/clear/status) = bentuk <chatId> <token> untuk konteks
		// saat ini; selain itu angka pertama = nomor jadibot tujuan.
		const SUBKEY = ['test', 'clear', 'reset', 'stat', 'status', 'list'];
		let isNum = first.length >= 10 && !(parts.length === 2 && !SUBKEY.includes((parts[1] || '').toLowerCase()));
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
					await m.reply('❌ Pengaturan bot utama khusus owner. Untuk jadibot gunakan: `.settg <nomor> <chatId> <token>`');
					return;
				}
				num = '';
				actionParts = parts;
			}
		}

		const sessionDir = num ? jadibotSessionDir(num) : process.cwd();
		const cfgFile = num ? path.join(sessionDir, 'telegram.json') : path.join(process.cwd(), 'telegram.json');
		const fakeHisoka = num ? { isJadibot: true, _isClone: true, _cloneNumber: num, _dataDir: sessionDir } : { isJadibot: false, _isClone: false };
		const cur = getTelegramCfg(fakeHisoka);

		const sub = (actionParts[0] || '').toLowerCase();

		if (!sub || sub === 'stat' || sub === 'status' || sub === 'list') {
			const mask = s => s ? s.slice(0, 8) + '...' + s.slice(-4) : '(kosong)';
			const label = num ? `Jadibot ${num}` : `Bot Utama`;
			const lines = [
				`📨 *TELEGRAM CONFIG — ${label}*`, '',
				`Chat ID : \`${cur.chatId || '(kosong)'}\``,
				`Token   : ${cur.token ? '`' + mask(cur.token) + '`' : '(kosong)'}`, '',
				`Status  : ${cur.chatId && cur.token ? 'AKTIF ✅' : 'BELUM DISET ❌'}`, '',
				`*Cara pakai:*`,
				num ? `• \`.settg ${num} <chatId> <token>\`` : `• \`.settg <chatId> <token>\``,
				num ? `• \`.settg ${num} test\`` : `• \`.settg test\``,
				num ? `• \`.settg ${num} clear\`` : `• \`.settg clear\``,
			];
			await m.reply(lines.join('\n'));
			return;
		}

		if (sub === 'clear' || sub === 'reset') {
			try {
				if (num) fs.unlinkSync(cfgFile);
				else {
					fs.writeFileSync(cfgFile, JSON.stringify({ chatId: '', token: '' }, null, 2) + '\n');
				}
			} catch {}
			await m.reply(`🗑️ Config Telegram untuk *${num || 'Bot Utama'}* dihapus.`);
			return;
		}

		if (sub === 'test') {
			if (!cur.chatId || !cur.token) {
				await m.reply(`❌ Belum diset. Gunakan: \`.settg ${num ? num + ' ' : ''}<chatId> <token>\``);
				return;
			}
			try {
				const { telegram } = await import('../../helper/index.js');
				const res = await telegram.send(cur.chatId, `🧪 Test dari ${num ? 'jadibot ' + num : 'bot utama'}`, { type: 'text', token: cur.token });
				if (res?.ok) await m.reply('✅ Test berhasil! Cek Telegram.');
				else await m.reply('❌ Gagal: ' + (res?.description || 'unknown error'));
			} catch (e) { await m.reply('❌ Error: ' + (e?.message || e)); }
			return;
		}

		const chatId = actionParts[0];
		const token = actionParts.slice(1).join(' ');

		if (!chatId || !token) {
			await m.reply(`Format salah.\nContoh: \`.settg ${num ? num + ' ' : ''}-1001234567890 123456:ABC-DEF...\``);
			return;
		}

		try {
			fs.mkdirSync(path.dirname(cfgFile), { recursive: true });
			fs.writeFileSync(cfgFile, JSON.stringify({ chatId, token }, null, 2) + '\n');
			await m.reply(`✅ Config Telegram diset untuk *${num || 'Bot Utama'}*.\nChat ID: \`${chatId}\`\nToken: \`${token.slice(0, 8)}...\`\n\n_Tes: \`.settg ${num ? num + ' ' : ''}test\`_`);
		} catch (e) { await m.reply('❌ Gagal simpan: ' + (e?.message || e)); }
	},
};
