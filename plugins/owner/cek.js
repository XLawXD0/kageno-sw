'use strict';
// Command: cek / ceks / nama
// Cek nama kontak dari nomor.

import fs from 'fs';
import path from 'path';
import { jidNormalizedUser } from '../../src/compat.js';

function toJid(input) {
	let s = String(input).trim();
	if (!s) return '';
	if (s.includes('@')) return s;
	s = s.replace(/[^0-9]/g, '');
	if (!s) return '';
	if (s.startsWith('0')) s = '62' + s.slice(1);
	else if (s.startsWith('8')) s = '62' + s;
	else if (!s.startsWith('62')) s = '62' + s;
	return s + '@s.whatsapp.net';
}

/** Cari kontak dengan multi-JID: cocokkan id, lid, phoneNumber. */
function findContact(hisoka, jids) {
	const norm = jids.filter(Boolean).map(j => jidNormalizedUser(j));
	const nums = norm.map(j => j.split('@')[0].split(':')[0]);

	try {
		for (const k of hisoka.contacts.values()) {
			if (!k) continue;
			const fields = [k.id, k.lid, k.phoneNumber].filter(Boolean).map(j => jidNormalizedUser(j));
			const fieldNums = fields.map(j => j.split('@')[0].split(':')[0]);
			for (const n of nums) {
				if (!n) continue;
				if (fieldNums.includes(n)) return k;
			}
		}
	} catch (e) {
		console.error('[cek] iterasi error:', e?.message);
	}
	return null;
}

async function tryResolveLid(hisoka, jid) {
	try {
		const lid = await hisoka.signalRepository?.lidMapping?.getLIDForPN?.(jid);
		if (lid && String(lid).endsWith('@lid')) return jidNormalizedUser(lid);
	} catch {}
	try {
		const pn = await hisoka.signalRepository?.lidMapping?.getPNForLID?.(jid);
		if (pn && !String(pn).endsWith('@lid')) return jidNormalizedUser(pn);
	} catch {}
	return null;
}

export default {
	name: 'cek',
	aliases: ['ceks', 'checkcontact', 'nama'],
	category: 'owner',
	desc: 'Cek nama kontak dari nomor. .cek <nomor> | .cek stat | .cek list <keyword>',
	async run(ctx) {
		const { hisoka, m, query } = ctx;
		const arg = (query || '').trim();

		// --- stat ---
		if (!arg || /^stat(us)?$/i.test(arg)) {
			let total = 0, withName = 0, withNotify = 0, withPn = 0, withLid = 0;
			try {
				total = hisoka.contacts.size || 0;
				for (const c of hisoka.contacts.values()) {
					if (!c) continue;
					if (c.name) withName++;
					if (c.notify) withNotify++;
					if (c.phoneNumber) withPn++;
					if (c.lid) withLid++;
				}
			} catch (e) {
				await m.reply('❌ ' + (e?.message || e));
				return;
			}
			await m.reply(
				`📇 *STATUS KONTAK*\n\n` +
				`Total      : ${total}\n` +
				`nama       : ${withName}\n` +
				`notify     : ${withNotify}\n` +
				`phoneNumber: ${withPn}\n` +
				`lid        : ${withLid}`
			);
			return;
		}

		// --- sync (force resync app state) ---
		if (/^sync$/i.test(arg)) {
			await m.reply('🔄 Resync app state...');
			try {
				await hisoka.resyncAppState(['critical_unblock_low', 'regular_low', 'regular_high'], true);
				await m.reply('✅ Selesai. Tunggu 30 detik lalu cek lagi.');
			} catch (e) { await m.reply('❌ ' + (e?.message || e)); }
			return;
		}

		// --- list <kw> ---
		const listMatch = arg.match(/^list\s+(.+)$/i);
		if (listMatch) {
			const kw = listMatch[1].toLowerCase();
			const found = [];
			try {
				for (const c of hisoka.contacts.values()) {
					if (!c) continue;
					const hay = [c.name, c.notify, c.verifiedName, c.id, c.lid, c.phoneNumber].filter(Boolean).join(' ').toLowerCase();
					if (hay.includes(kw)) { found.push(c); if (found.length >= 20) break; }
				}
			} catch {}
			if (!found.length) { await m.reply(`🔍 Tidak ada kontak cocok: *${listMatch[1]}*`); return; }
			const lines = found.map((c, i) => {
				const num = (c.id || '').split('@')[0].split(':')[0];
				const nm = c.name || c.notify || c.verifiedName || '(tanpa nama)';
				return `${i + 1}. *${nm}*\n   📞 ${num}`;
			});
			await m.reply(`🔍 *Hasil cari:*\n\n${lines.join('\n')}`);
			return;
		}

		// --- cek <nomor> ---
		const jid = toJid(arg);
		if (!jid) { await m.reply('Contoh: `.cek 628123456789`'); return; }

		const numOnly = jid.split('@')[0];
		let contact = findContact(hisoka, [jid]);
		let resolvedVia = 'direct';

		// Kalau nggak ketemu, coba resolve LID ↔ PN
		if (!contact) {
			const altJid = await tryResolveLid(hisoka, jid);
			if (altJid) {
				contact = findContact(hisoka, [altJid]);
				if (contact) resolvedVia = 'lid-mapping';
			}
		}

		if (!contact) {
			let waInfo = null;
			try { const r = await hisoka.onWhatsApp(jid); waInfo = r?.[0] || null; } catch {}
			await m.reply(
				`🔍 *HASIL CEK*\n\n` +
				`📞 Nomor : \`${numOnly}\`\n` +
				`❌ Tidak ada di contacts.json\n\n` +
				(waInfo
					? `*Dari WA server:*\n✅ Terdaftar\n👤 notify: ${waInfo.notify || '(kosong)'}\n📝 verified: ${waInfo.verifiedName || '(kosong)'}`
					: `⚠️ Nggak bisa query WA server.`) +
				`\n\n_Orang harus kirim pesan ke bot dulu, atau coba \`.cek sync\`._`
			);
			return;
		}

		const lines = [];
		lines.push(`📞 *Nomor :* \`${numOnly}\``);
		if (contact.id) lines.push(`🆔 *JID :* \`${contact.id}\``);
		if (contact.lid) lines.push(`🔗 *LID :* \`${contact.lid}\``);
		if (contact.phoneNumber) lines.push(`📱 *phoneNumber :* \`${contact.phoneNumber}\``);
		lines.push('');
		lines.push(`👤 *name*     : ${contact.name || '_(kosong)_'}`);
		lines.push(`📢 *notify*   : ${contact.notify || '_(kosong)_'}`);
		lines.push(`✅ *verified* : ${contact.verifiedName || '_(kosong)_'}`);
		lines.push(`💾 *isContact*: ${contact.isContact ? 'Ya' : 'Tidak'}`);

		const effective = contact.name || contact.verifiedName || contact.notify || '(nomor)';
		lines.push('');
		lines.push(`🎯 *Tampil di Telegram:* *${effective}*`);
		if (resolvedVia === 'lid-mapping') lines.push(`_🔗 ketemu via LID mapping_`);

		await m.reply(`🔍 *HASIL CEK KONTAK*\n\n${lines.join('\n')}`);
	},
};