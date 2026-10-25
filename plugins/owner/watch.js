'use strict';
// Command: watch — kelola daftar pantauan (per-instance)
// Kategori: owner

import fs from 'fs';
import { jidNormalizedUser } from '../../src/compat.js';
import { rootPath, dataDirPath } from '../../helper/paths.js';

function loadWatch(hisoka) {
	const file = rootPath(hisoka, 'watch.json');
	try {
		const d = JSON.parse(fs.readFileSync(file, 'utf-8') || '{}');
		return {
			numbers: Array.isArray(d.numbers) ? d.numbers.map(n => String(n).replace(/[^0-9]/g, '')).filter(Boolean) : [],
			forward_media: d.forward_media !== false,
		};
	} catch { return { numbers: [], forward_media: true }; }
}
function saveWatch(d, hisoka) {
	fs.writeFileSync(rootPath(hisoka, 'watch.json'), JSON.stringify(d, null, 2) + '\n');
}
function loadFwd(hisoka) {
	const file = dataDirPath(hisoka, 'forward.json');
	try {
		const d = JSON.parse(fs.readFileSync(file, 'utf-8') || '{}');
		return { watchEnabled: d.watchEnabled !== false, watchChannel: d.watchChannel || 'tg' };
	} catch { return { watchEnabled: true, watchChannel: 'tg' }; }
}
function saveFwd(patch, hisoka) {
	const file = dataDirPath(hisoka, 'forward.json');
	let cur = {};
	try { cur = JSON.parse(fs.readFileSync(file, 'utf-8') || '{}'); } catch {}
	fs.writeFileSync(file, JSON.stringify({ ...cur, ...patch }, null, 2) + '\n');
}
function normalizeNum(v) {
	let s = String(v || '').trim();
	if (!s) return '';
	if (s.includes('@')) s = s.split('@')[0];
	s = s.replace(/[^0-9]/g, '');
	if (!s) return '';
	if (s.startsWith('0')) s = '62' + s.slice(1);
	else if (s.startsWith('8')) s = '62' + s;
	else if (!s.startsWith('62')) s = '62' + s;
	return s;
}
function chLabel(c) {
	if (c === 'wa') return '🟢 WA';
	if (c === 'tg') return '🔵 TG';
	if (c === 'both') return '🟣 WA+TG';
	if (c === 'off') return '⭕ OFF';
	return c;
}

export default {
	name: 'watch',
	aliases: ['pantau', 'watchlist'],
	category: 'owner',
	desc: 'Kelola daftar pantauan (add/del/list/clear)',
	async run(ctx) {
		const { hisoka, m, query } = ctx;
		const arg = (query || '').trim();
		const lower = arg.toLowerCase();
		const watch = loadWatch(hisoka);
		const fwd = loadFwd(hisoka);

		if (!arg) {
			const lines = [];
			lines.push(`👀 *PANTAUAN*`);
			lines.push(`Toggle : ${fwd.watchEnabled ? 'ON ✅' : 'OFF ❌'}`);
			lines.push(`Channel: ${chLabel(fwd.watchChannel)}`);
			lines.push(`Media  : ${watch.forward_media ? 'Diteruskan ✅' : 'Teks saja ❌'}`);
			lines.push('');
			lines.push(`*List (${watch.numbers.length}):*`);
			if (!watch.numbers.length) lines.push('(kosong)');
			else {
				watch.numbers.forEach((n, i) => {
					let name = '';
					try { name = hisoka.getName(`${n}@s.whatsapp.net`, true); if (/^\d+$/.test(name)) name = ''; } catch {}
					lines.push(`${i + 1}. \`${n}\`${name ? ' — ' + name : ''}`);
				});
			}
			lines.push('');
			lines.push(`*Perintah:*`);
			lines.push(`• \`.watch add <nomor>\` — tambah`);
			lines.push(`• \`.watch del <nomor>\` — hapus`);
			lines.push(`• \`.watch clear\` — hapus semua`);
			lines.push(`• \`.watch on|off\` — toggle`);
			lines.push(`• \`.watch ch wa|tg|both\` — channel`);
			lines.push(`• \`.watch media on|off\` — forward media`);
			lines.push(`• Reply pesan orang + \`.watch add\` — tambah otomatis`);
			await m.reply(lines.join('\n'));
			return;
		}

		if (lower === 'add' || lower === '+') {
			let num = '';
			if (m.isQuoted) {
				const q = m.quoted;
				const senderJid = q.sender || q.participant || q.key?.participant || q.key?.remoteJid;
				if (senderJid) {
					const norm = jidNormalizedUser(senderJid);
					num = norm.split('@')[0].split(':')[0];
					if (String(senderJid).endsWith('@lid')) {
						try {
							const pn = await hisoka.signalRepository?.lidMapping?.getPNForLID?.(senderJid);
							if (pn) num = String(pn).split('@')[0].split(':')[0];
						} catch {}
					}
				}
			}
			if (!num) num = normalizeNum(arg.split(/\s+/)[1]);
			if (!num) { await m.reply('Kasih nomornya atau reply pesan orang.'); return; }
			if (watch.numbers.includes(num)) { await m.reply(`⚠️ \`${num}\` sudah ada.`); return; }
			watch.numbers.push(num);
			saveWatch(watch, hisoka);
			let name = '';
			try { name = hisoka.getName(`${num}@s.whatsapp.net`, true); } catch {}
			await m.reply(`✅ Ditambahkan:\n\`${num}\`${name && !/^\d+$/.test(name) ? ' (' + name + ')' : ''}\n\nTotal: ${watch.numbers.length}.`);
			return;
		}

		if (lower === 'del' || lower === 'delete' || lower === 'rm' || lower === '-') {
			let num = '';
			if (m.isQuoted) {
				const q = m.quoted;
				const senderJid = q.sender || q.participant || q.key?.participant || q.key?.remoteJid;
				if (senderJid) {
					const norm = jidNormalizedUser(senderJid);
					num = norm.split('@')[0].split(':')[0];
					if (String(senderJid).endsWith('@lid')) {
						try {
							const pn = await hisoka.signalRepository?.lidMapping?.getPNForLID?.(senderJid);
							if (pn) num = String(pn).split('@')[0].split(':')[0];
						} catch {}
					}
				}
			}
			if (!num) num = normalizeNum(arg.split(/\s+/)[1]);
			if (!num) { await m.reply('Kasih nomornya atau reply pesan orang.'); return; }
			const before = watch.numbers.length;
			watch.numbers = watch.numbers.filter(n => n !== num);
			if (watch.numbers.length === before) { await m.reply(`⚠️ \`${num}\` tidak ada di list.`); return; }
			saveWatch(watch, hisoka);
			await m.reply(`🗑️ \`${num}\` dihapus.\n\nSisa: ${watch.numbers.length}.`);
			return;
		}

		if (lower === 'clear' || lower === 'reset') {
			watch.numbers = [];
			saveWatch(watch, hisoka);
			await m.reply('🗑️ Semua nomor pantauan dihapus.');
			return;
		}

		if (['on', '1', 'nyala', 'ya', 'true'].includes(lower)) {
			saveFwd({ watchEnabled: true }, hisoka);
			await m.reply('👀 Pantauan → *ON ✅*');
			return;
		}
		if (['off', '0', 'mati', 'tidak', 'false'].includes(lower)) {
			saveFwd({ watchEnabled: false }, hisoka);
			await m.reply('👀 Pantauan → *OFF ❌*');
			return;
		}

		if (lower.startsWith('ch ') || lower.startsWith('channel ')) {
			const ch = lower.split(/\s+/)[1];
			if (!['wa', 'tg', 'both', 'off'].includes(ch)) { await m.reply('Pakai: `.watch ch wa|tg|both|off`'); return; }
			saveFwd({ watchChannel: ch }, hisoka);
			await m.reply(`👀 Channel → *${ch.toUpperCase()}*`);
			return;
		}

		if (lower.startsWith('media ')) {
			const v = lower.split(/\s+/)[1];
			if (['on', '1', 'nyala', 'ya', 'true'].includes(v)) {
				watch.forward_media = true; saveWatch(watch, hisoka);
				await m.reply('📷 Media → *ON ✅*');
				return;
			}
			if (['off', '0', 'mati', 'tidak', 'false'].includes(v)) {
				watch.forward_media = false; saveWatch(watch, hisoka);
				await m.reply('📷 Media → *OFF ❌* (teks saja)');
				return;
			}
			await m.reply('Pakai: `.watch media on|off`');
			return;
		}

		await m.reply(`❓ Perintah tidak dikenal.\n\nKetik \`.watch\` untuk panduan.`);
	},
};