'use strict';
// Command: rvo / read / viewonce / vo (per-instance)

import fs from 'fs';
import { jidNormalizedUser } from '../../src/compat.js';
import { dataDirPath } from '../../helper/paths.js';

function loadCfg(hisoka) {
	try {
		const d = JSON.parse(fs.readFileSync(dataDirPath(hisoka, 'forward.json'), 'utf-8') || '{}');
		return { viewonceEnabled: d.viewonceEnabled !== false, viewonceChannel: d.viewonceChannel || 'tg' };
	} catch { return { viewonceEnabled: true, viewonceChannel: 'tg' }; }
}
function saveCfg(patch, hisoka) {
	const file = dataDirPath(hisoka, 'forward.json');
	let cur = {};
	try { cur = JSON.parse(fs.readFileSync(file, 'utf-8') || '{}'); } catch {}
	fs.writeFileSync(file, JSON.stringify({ ...cur, ...patch }, null, 2) + '\n');
}

function findViewOnceMedia(obj, depth = 0) {
	if (!obj || typeof obj !== 'object' || depth > 6) return null;
	for (const k of ['imageMessage', 'videoMessage', 'audioMessage', 'documentMessage']) {
		if (obj[k] && obj[k].viewOnce === true) return { type: k.replace('Message', ''), content: obj[k] };
	}
	for (const w of ['viewOnceMessage','viewOnceMessageV2','viewOnceMessageV2Extension','ephemeralMessage','deviceSentMessage','documentWithCaptionMessage']) {
		if (obj[w]?.message) { const f = findViewOnceMedia(obj[w].message, depth + 1); if (f) return f; }
	}
	return null;
}
function findAnyMedia(obj, depth = 0) {
	if (!obj || typeof obj !== 'object' || depth > 6) return null;
	for (const k of ['imageMessage', 'videoMessage', 'audioMessage', 'documentMessage']) {
		if (obj[k]) return { type: k.replace('Message', ''), content: obj[k] };
	}
	for (const w of ['viewOnceMessage','viewOnceMessageV2','viewOnceMessageV2Extension','ephemeralMessage','deviceSentMessage','documentWithCaptionMessage']) {
		if (obj[w]?.message) { const f = findAnyMedia(obj[w].message, depth + 1); if (f) return f; }
	}
	return null;
}
async function resolveName(hisoka, jids, pushName) {
	const norm = jids.filter(Boolean).map(j => { try { return jidNormalizedUser(j); } catch { return null; } }).filter(Boolean);
	for (const j of norm) { try { const n = hisoka.getName(j, true); if (n && !/^\d+$/.test(n)) return n; } catch {} }
	for (const j of norm) {
		try {
			let alt = null;
			if (String(j).endsWith('@lid')) alt = await hisoka.signalRepository?.lidMapping?.getPNForLID?.(j);
			else alt = await hisoka.signalRepository?.lidMapping?.getLIDForPN?.(j);
			if (alt) { const n = hisoka.getName(jidNormalizedUser(alt), true); if (n && !/^\d+$/.test(n)) return n; }
		} catch {}
	}
	return pushName || norm[0]?.split('@')[0].split(':')[0] || 'unknown';
}
function getOwnerJid(hisoka) {
	if (hisoka?._isClone || hisoka?.isJadibot) {
		const num = hisoka._cloneNumber || (hisoka.user?.id || '').split('@')[0];
		if (num) return `${num}@s.whatsapp.net`;
	}
	const owners = (process.env.BOT_NUMBER_OWNER || '').split(',').map(x => x.trim()).filter(Boolean);
	if (!owners.length) return null;
	const clean = owners[0].replace(/[^0-9]/g, '');
	return clean ? `${clean}@s.whatsapp.net` : null;
}

async function forwardManual(hisoka, m, hit, media) {
	const cfg = loadCfg(hisoka);
	if (!cfg.viewonceEnabled) { await m.reply('❌ Fitur view-once OFF. Aktifkan: `.fwd rvo on`'); return; }
	const ch = cfg.viewonceChannel;
	const wantWA = ch === 'wa' || ch === 'both';
	const wantTG = ch === 'tg' || ch === 'both';
	if (!wantWA && !wantTG) { await m.reply('❌ Channel view-once OFF. Set: `.fwd rvoch wa|tg|both`'); return; }

	const q = m.quoted;
	const senderJid = jidNormalizedUser(q.sender || q.participant || q.from);
	const senderNum = String(senderJid).split('@')[0].split(':')[0];
	const senderName = await resolveName(hisoka,
		[q.sender, q.participant, q.key?.participant, q.key?.participantAlt, q.key?.remoteJidAlt, q.key?.remoteJid, senderJid],
		q.pushName || q.key?.pushName);

	const when = new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });
	const isGroup = (q.from || '').endsWith('@g.us');
	const chatName = isGroup ? hisoka.getName(q.from) : 'Chat Pribadi';
	const caption = hit.content.caption || '';
	const tgType = ['image', 'video', 'audio', 'sticker'].includes(hit.type) ? hit.type : 'document';

	let sentWA = false, sentTG = false;

	if (wantWA) {
		const ownerJid = getOwnerJid(hisoka);
		if (!ownerJid) { await m.reply('❌ BOT_NUMBER_OWNER belum diset di .env'); return; }
		try {
			const waCaption = `🔓 *READVIEWONCE (MANUAL)*\nSumber : 👁️ View-once / Sekali lihat\nDari   : ${senderName} (${senderNum})\nDi     : ${isGroup ? chatName : 'Chat Pribadi'}\nWaktu  : ${when}` + (caption ? `\n\nCaption :\n${caption}` : '');
			const content = {};
			if (tgType === 'image') content.image = media;
			else if (tgType === 'video') content.video = media;
			else if (tgType === 'audio') content.audio = media;
			else if (tgType === 'sticker') content.sticker = media;
			else content.document = media;
			if (tgType !== 'sticker') content.caption = waCaption.slice(0, 1024);
			await hisoka.sendMessage(ownerJid, content);
			sentWA = true;
		} catch (e) { console.error('[rvo] WA gagal:', e?.message || e); }
	}

	if (wantTG) {
		const { getTelegramCfg } = await import('../../helper/paths.js');
		const tg = getTelegramCfg(hisoka);
		if (tg.chatId && tg.token) {
			try {
				const { telegram } = await import('../../helper/index.js');
				const tgCaption = `🔓 <b>READVIEWONCE (MANUAL)</b>\n<b>Sumber :</b> 👁️ View-once\n<b>Dari :</b> <a href="https://wa.me/${senderNum}">${senderName}</a> (${senderNum})\n<b>Di :</b> ${isGroup ? '👥 ' + chatName : '💬 Chat Pribadi'}\n<b>Waktu :</b> ${when}` + (caption ? `\n<b>Caption :</b>\n${caption}` : '') + `\n\n<b>#READVIEWONCE</b>`;
				const isPtt = tgType === 'audio' && !!hit.content.ptt;
				const sendType = tgType === 'audio' && !isPtt ? 'document' : tgType;
				if (tgType === 'sticker') await telegram.send(tg.chatId, tgCaption, { type: 'text', parse_mode: 'HTML', token: tg.token });
				const res = await telegram.send(tg.chatId, media, {
					type: sendType, token: tg.token,
					...(tgType === 'sticker' ? {} : { caption: tgCaption.slice(0, 1000), parse_mode: 'HTML' }),
				});
				if (res?.ok === false) console.error('[rvo] TG tolak:', res.description);
				else sentTG = true;
			} catch (e) { console.error('[rvo] TG gagal:', e?.message || e); }
		}
	}

	const dests = [];
	if (sentWA) dests.push('WA');
	if (sentTG) dests.push('TG');
	if (dests.length) await m.reply(`✅ Diteruskan ke ${dests.join(' + ')}.`);
	else await m.reply('❌ Gagal kirim (channel OFF atau config kosong).');
}

export default {
	name: 'rvo',
	aliases: ['read', 'viewonce', 'vo'],
	category: 'tools',
	desc: 'Buka view-once manual (reply) atau toggle auto ke WA/TG',
	async run(ctx) {
		const { hisoka, m, query } = ctx;
		const arg = (query || '').trim().toLowerCase();
		const cfg = loadCfg(hisoka);

		if (m.isQuoted && m.quoted) {
			const q = m.quoted;
			const candidates = [
				q.message,
				m.message?.extendedTextMessage?.contextInfo?.quotedMessage,
				m.message?.imageMessage?.contextInfo?.quotedMessage,
				m.message?.videoMessage?.contextInfo?.quotedMessage,
				m.message?.audioMessage?.contextInfo?.quotedMessage,
				m.message?.documentMessage?.contextInfo?.quotedMessage,
				m.message?.conversation?.contextInfo?.quotedMessage,
			].filter(Boolean);
			let hit = null;
			for (const c of candidates) { const f = findViewOnceMedia(c); if (f) { hit = f; break; } }
			if (!hit && q.key?.isViewOnce === true) {
				for (const c of candidates) { const f = findAnyMedia(c); if (f) { hit = f; break; } }
			}
			if (!hit) { await m.reply('Ini bukan pesan view-once.'); return; }
			let media = null;
			try { media = await q.downloadMedia(); } catch {}
			if (!media) {
				try {
					const { downloadContentFromMessage } = await import('../../src/compat.js');
					const stream = await downloadContentFromMessage(hit.content, hit.type);
					const chunks = []; for await (const chunk of stream) chunks.push(chunk);
					media = Buffer.concat(chunks);
				} catch (e) { console.error('[rvo] download gagal:', e?.message || e); }
			}
			if (!media || media.length < 100) { await m.reply('❌ Media kosong / gagal diunduh.'); return; }
			await forwardManual(hisoka, m, hit, media);
			return;
		}

		const chLabel = c => c === 'wa' ? '🟢 WA' : c === 'tg' ? '🔵 TG' : c === 'both' ? '🟣 WA+TG' : c;
		if (!arg || arg === 'stat' || arg === 'status') {
			await m.reply(`🔓 *AUTO VIEW-ONCE*\n\nStatus  : *${cfg.viewonceEnabled ? 'ON ✅' : 'OFF ❌'}*\nChannel : *${chLabel(cfg.viewonceChannel)}*\n\n• \`.rvo on|off\`\n• \`.rvo wa|tg|both\`\n• Reply view-once + \`.rvo\``);
			return;
		}
		if (['on', '1', 'true', 'nyala', 'ya'].includes(arg)) { saveCfg({ viewonceEnabled: true }, hisoka); await m.reply('🔓 Auto view-once → *ON ✅*'); return; }
		if (['off', '0', 'false', 'mati', 'tidak'].includes(arg)) { saveCfg({ viewonceEnabled: false }, hisoka); await m.reply('🔓 Auto view-once → *OFF ❌*'); return; }
		if (['wa', 'tg', 'both', 'off'].includes(arg)) { saveCfg({ viewonceChannel: arg }, hisoka); await m.reply(`🔓 Channel → *${chLabel(arg)}*`); return; }
		await m.reply('Pakai: `.rvo on|off|wa|tg|both|stat`\nAtau reply view-once + `.rvo`.');
	},
};