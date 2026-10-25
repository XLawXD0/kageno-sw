'use strict';
// Command: block / unblock / blocklist (per-instance)
// Kategori: owner

import fs from 'fs';
import { rootPath } from '../../helper/paths.js';

function loadBlock(hisoka) {
	const file = rootPath(hisoka, 'forwardblock.json');
	try {
		const d = JSON.parse(fs.readFileSync(file, 'utf-8') || '{}');
		return { jids: Array.isArray(d.jids) ? d.jids : [], names: Array.isArray(d.names) ? d.names : [] };
	} catch { return { jids: [], names: [] }; }
}
function saveBlock(d, hisoka) {
	const file = rootPath(hisoka, 'forwardblock.json');
	fs.writeFileSync(file, JSON.stringify(d, null, 2) + '\n');
}
function extractJid(raw) {
	if (!raw) return '';
	let s = String(raw).trim();
	const waMe = s.match(/wa\.me\/(\d+)/i);
	if (waMe) return waMe[1] + '@s.whatsapp.net';
	return s;
}

async function doBlock(ctx) {
	const { hisoka, m, query } = ctx;
	let arg = (query || '').trim();
	let targetJid = '';
	let targetName = '';

	if (arg && /^nama\s+/i.test(arg)) {
		const nm = arg.replace(/^nama\s+/i, '').trim().toLowerCase();
		if (!nm) { await m.reply('❌ Nama kosong.'); return; }
		const b = loadBlock(hisoka);
		if (b.names.map(x => x.toLowerCase()).includes(nm)) { await m.reply(`✅ Nama "${nm}" sudah ada di blocklist.`); return; }
		b.names.push(nm);
		saveBlock(b, hisoka);
		await m.reply(`🚫 Nama *${nm}* diblok dari forward.`);
		return;
	}

	if (arg) {
		targetJid = extractJid(arg);
		try { targetName = hisoka.getName(targetJid, true) || ''; } catch {}
	} else if (m.isQuoted && m.quoted?.key?.remoteJid) {
		targetJid = m.quoted.key.remoteJid;
		try { targetName = hisoka.getName(targetJid, true) || ''; } catch {}
	} else {
		const cur = m.from || '';
		const curName = (() => { try { return hisoka.getName(cur, true) || '-'; } catch { return '-'; } })();
		await m.reply(
			`🚫 *BLOCK FORWARD*\n\nChat ini:\n📍 JID: \`${cur}\`\n📍 Nama: ${curName}\n\n` +
			`• \`.block\` — reply pesan\n• \`.block <JID>\` — manual\n• \`.block nama <teks>\` — by nama\n` +
			`• \`.unblock <JID>\` — hapus\n• \`.blocklist\` — lihat`
		);
		return;
	}

	if (!targetJid) { await m.reply('❌ JID kosong. Reply pesan atau kirim JID.'); return; }
	const b = loadBlock(hisoka);
	const num = targetJid.split('@')[0].split(':')[0];
	if (b.jids.some(x => x === targetJid || x === num)) { await m.reply(`✅ \`${targetJid}\` sudah ada.`); return; }
	b.jids.push(targetJid);
	saveBlock(b, hisoka);
	await m.reply(`🚫 Diblok:\n📍 ${targetJid}\n📍 ${targetName || '(tanpa nama)'}`);
}

async function doUnblock(ctx) {
	const { hisoka, m, query } = ctx;
	const arg = (query || '').trim();
	if (!arg) { await m.reply('Contoh: `.unblock 120363382298733791`\natau: `.unblock nama kuro mugen`'); return; }
	const b = loadBlock(hisoka);
	let removed = 0;
	if (/^nama\s+/i.test(arg)) {
		const nm = arg.replace(/^nama\s+/i, '').trim().toLowerCase();
		const before = b.names.length;
		b.names = b.names.filter(x => x.toLowerCase() !== nm);
		removed = before - b.names.length;
	} else {
		const num = arg.split('@')[0].split(':')[0];
		const before = b.jids.length;
		b.jids = b.jids.filter(x => x !== arg && x !== num && x.split('@')[0] !== num);
		removed = before - b.jids.length;
	}
	if (!removed) { await m.reply(`❌ \`${arg}\` nggak ada di blocklist.`); return; }
	saveBlock(b, hisoka);
	await m.reply(`✅ \`${arg}\` dihapus dari blocklist.`);
}

async function doList(ctx) {
	const { hisoka, m } = ctx;
	const b = loadBlock(hisoka);
	if (!b.jids.length && !b.names.length) { await m.reply('📭 Blocklist kosong.'); return; }
	let text = '🚫 *BLOCKLIST FORWARD*\n\n';
	if (b.jids.length) text += `*JID (${b.jids.length}):*\n` + b.jids.map((j, i) => `${i + 1}. \`${j}\``).join('\n') + '\n\n';
	if (b.names.length) text += `*Nama (${b.names.length}):*\n` + b.names.map((n, i) => `${i + 1}. ${n}`).join('\n');
	text += '\n\n_Hapus: .unblock <JID/nama>_';
	await m.reply(text);
}

export default {
	name: 'block',
	aliases: ['unblock', 'blocklist'],
	category: 'owner',
	desc: 'Block chat/channel/grup dari forward Telegram',
	async run(ctx) {
		const cmd = (ctx.m.command || '').toLowerCase();
		if (cmd === 'blocklist') return doList(ctx);
		if (cmd === 'unblock') return doUnblock(ctx);
		return doBlock(ctx);
	},
};