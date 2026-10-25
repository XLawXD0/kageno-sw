'use strict';

import fs from 'fs';
import path from 'path';
import { jidNormalizedUser, toNumber, jidDecode, proto, isPnUser } from '../src/compat.js';

import { telegram } from '../helper/index.js';
import { injectMessage } from '../helper/inject.js';
import { isNumber } from '../helper/text.js';
import { readSwConfig, pickEmoji } from '../helper/swconfig.js';
import { loadForwardCfg, channelHas, sendToOwnerWA } from '../helper/forward.js';
import { getTelegramCfg, isCloneCtx, rootPath, dataDirPath } from '../helper/paths.js';

import { saveMessage, loadMessage } from '../helper/msg-cache.js';
import { downloadMediaRetry, rawCaption } from '../helper/utils.js';
// Tag pengirim/penerima untuk pesan Telegram (HTML): @Nama -> wa.me/nomor
const escTg = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

import { isSwReadIgnored, isSwReactIgnored } from '../helper/swignore.js';
const tgSeen = new Set();

function cachePushName(hisoka, m) {
	try {
		if (!m || !m.pushName || m.status) return;
		const senderJid = m.sender || m.participant;
		if (!senderJid) return;
		const pn = jidNormalizedUser(senderJid);
		const existing = hisoka.contacts.read(pn) || {};
		if (!existing.name && !existing.notify) {
			hisoka.contacts.write(pn, { ...existing, id: pn, notify: String(m.pushName).trim() });
		}
	} catch {}
}

async function resolveNameMultiJid(hisoka, jids, fallbackPushName = null) {
	const norm = jids.filter(Boolean).map(j => { try { return jidNormalizedUser(j); } catch { return null; } }).filter(Boolean);
	for (const j of norm) {
		try { const n = hisoka.getName(j, true); if (n && !/^\d+$/.test(n)) return n; } catch {}
	}
	for (const j of norm) {
		try {
			let alt = null;
			if (String(j).endsWith('@lid')) alt = await hisoka.signalRepository?.lidMapping?.getPNForLID?.(j);
			else alt = await hisoka.signalRepository?.lidMapping?.getLIDForPN?.(j);
			if (alt) { const n = hisoka.getName(jidNormalizedUser(alt), true); if (n && !/^\d+$/.test(n)) return n; }
		} catch {}
	}
	if (fallbackPushName) return fallbackPushName;
	return norm[0]?.split('@')[0].split(':')[0] || 'unknown';
}

async function resolveStatusPoster(m, hisoka) {
	const candidates = [m.key?.participantAlt, m.key?.participant, m.participant, m.sender, m.key?.remoteJidAlt, m.key?.remoteJid].filter(Boolean);
	for (const c of candidates) {
		try {
			const norm = jidNormalizedUser(c);
			if (norm === 'status@broadcast') continue;
			if (norm.endsWith('@lid')) {
				const pn = await hisoka.signalRepository?.lidMapping?.getPNForLID?.(norm).catch(() => null);
				if (pn && !String(pn).endsWith('@lid')) return jidNormalizedUser(pn);
				return norm;
			}
			return norm;
		} catch {}
	}
	return '';
}

// ==== BLOCKLIST (per-instance) ====
const _blockCache = new Map();
function getBlockFile(hisoka) {
	if (isCloneCtx(hisoka)) return rootPath(hisoka, 'forwardblock.json');
	return path.join(process.cwd(), 'forwardblock.json');
}
function loadBlocked(hisoka) {
	const file = getBlockFile(hisoka);
	try {
		const stat = fs.statSync(file);
		const cached = _blockCache.get(file);
		if (cached && cached.mtime === stat.mtimeMs) return cached.data;
		const d = JSON.parse(fs.readFileSync(file, 'utf-8') || '{}');
		const data = { jids: d.jids || [], names: d.names || [] };
		_blockCache.set(file, { data, mtime: stat.mtimeMs });
		return data;
	} catch { return { jids: [], names: [] }; }
}
function isBlocked(fromJid, hisoka) {
	if (!fromJid) return false;
	if (fromJid.endsWith('@newsletter')) return true;
	const b = loadBlocked(hisoka);
	const num = fromJid.split('@')[0].split(':')[0];
	for (const x of b.jids) {
		if (x === fromJid || x === num) return true;
		if (fromJid.startsWith(x + '@')) return true;
	}
	if (b.names.length) {
		try {
			const name = (hisoka?.getName?.(fromJid) || '').toLowerCase();
			if (name && b.names.some(x => name.includes(String(x).toLowerCase()))) return true;
		} catch {}
	}
	return false;
}

// ==== FORWARD PESAN MASUK ====
async function forwardMsg(m, hisoka) {
	if (m.status || m.key?.fromMe || m.isBot) return;
	if (['protocolMessage', 'reactionMessage', 'senderKeyDistributionMessage'].includes(m.type)) return;
	if (!m.isMedia && !m.text) return;

	cachePushName(hisoka, m);

	const id = m.key?.id;
	if (id) {
		// Kunci dedupe per-instance: bot utama & jadibot berjalan seproses dan
		// melihat pesan grup yang sama (id sama persis) — tanpa pembeda ini
		// forward milik jadibot tertelan dedupe bot utama.
		const seenKey = `${hisoka.user?.id || hisoka._cloneNumber || '?'}|${id}`;
		if (tgSeen.has(seenKey)) return;
		tgSeen.add(seenKey);
		if (tgSeen.size > 2000) tgSeen.delete(tgSeen.values().next().value);
	}

	try {
		const sender = jidNormalizedUser(m.participant || m.sender || m.from);
		let senderName = await resolveNameMultiJid(hisoka,
			[m.sender, m.participant, m.key?.participant, m.key?.participantAlt, m.key?.remoteJidAlt, m.from], m.pushName);
		// Channel (@newsletter): kontak lokal hanya punya ID sbg nama — ambil
		// nama asli channel dari metadata-nya bila resolusi lokal gagal.
		if (sender.endsWith('@newsletter') && /^\d+$/.test(String(senderName))) {
			try { senderName = (await hisoka.getNewsletterName?.(sender)) || senderName; } catch {}
		}
		const number = jidDecode(sender)?.user || sender.split('@')[0].split(':')[0];
		const when = new Date(toNumber(m.messageTimestamp) * 1000).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });
		const where = m.isGroup ? `👥 ${hisoka.getName(m.from)}\n` : '';
		// Pengirim @newsletter = Channel WhatsApp: nomornya ID channel, bukan
		// nomor HP — tautan wa.me tidak berlaku, tampilkan sebagai channel.
		const isNewsletter = sender.endsWith('@newsletter');
		const waHeader = isNewsletter
			? `${where}📣 Channel: ${senderName}\n🕒 ${when}`
			: `${where}👤 ${senderName} (${number})\n🕒 ${when}`;

		let media = null;
		let waType = '';
		if (m.isMedia) {
			media = await downloadMediaRetry(hisoka, m);
			if (media) waType = (m.type || '').replace('Message', '');
			else console.error('[fwd] download gagal total (3x percobaan):', m.key?.id);
		}

		const cfg = loadForwardCfg(hisoka);
		// forwardblock membisukan forward user-facing.
		const blocked = isBlocked(m.from, hisoka);
		// Arsipkan isi pesan ke disk untuk antidelete (semua pesan forward,
		// bukan cuma status) — dilewati bila chat terblokir.
		if (!blocked) saveMessage(hisoka, {
			id: m.key?.id, senderNum: number, name: senderName, when,
			text: m.text || rawCaption(m.raw), media, mediaType: waType,
			chat: m.from, chatName: m.isGroup ? hisoka.getName(m.from) : 'Chat Pribadi',
			isGroup: !!m.isGroup,
		});
		const wantWA = !blocked && cfg.messageEnabled && channelHas(cfg.messageChannel, 'wa');
		const wantTG = !blocked && cfg.messageEnabled && channelHas(cfg.messageChannel, 'tg');

		// ===== Kirim ke WA (user-facing) =====
		if (wantWA) {
			try {
				if (media) {
					const content = {};
					if (waType === 'image') content.image = media;
					else if (waType === 'video') content.video = media;
					else if (waType === 'audio') content.audio = media;
					else if (waType === 'sticker') content.sticker = media;
					else content.document = media;
					if (waType !== 'sticker') content.caption = `${waHeader}${m.text ? `\n\n${m.text}` : ''}`.slice(0, 1024);
					await sendToOwnerWA(hisoka, content);
				} else {
					await sendToOwnerWA(hisoka, { text: `${waHeader}\n\n${m.text}`.slice(0, 4000) });
				}
			} catch (e) { console.error('[fwd] WA gagal:', e?.message || e); }
		}

		// ===== Kirim ke TG (user-facing) =====
		if (wantTG) {
			const tg = getTelegramCfg(hisoka);
			if (tg.chatId && tg.token) {
				if (media) {
					const tgType = ['image', 'video', 'sticker', 'audio'].includes(waType) ? waType : 'document';
					const cap = `${waHeader}${m.text ? `\n\n${escTg(m.text)}` : ''}`.slice(0, 1000);
					if (tgType === 'sticker') await telegram.send(tg.chatId, waHeader, { type: 'text', token: tg.token });
					const isPtt = !!m.content?.ptt;
					const sendType = tgType === 'audio' && !isPtt ? 'document' : tgType;
					const res = await telegram.send(tg.chatId, media, {
						type: sendType, token: tg.token,
						...(tgType === 'sticker' ? {} : { caption: cap }),
					});
					if (res && res.ok === false) console.error('[fwd] TG user tolak:', res.description);
				} else {
					const res = await telegram.send(tg.chatId, `${waHeader}\n\n${escTg(m.text || '')}`.slice(0, 4000), { type: 'text', token: tg.token });
					if (res && res.ok === false) console.error('[fwd] TG user tolak:', res.description);
				}
			}
		}

	} catch (err) {
		console.error('[fwd] error:', err?.message || err);
	}
}

// ==== FORWARD STATUS (SW) ====
async function forwardStatus(m, hisoka, statusFrom, name, senderNum) {

	const when = new Date(toNumber(m.messageTimestamp) * 1000).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });
	const caption = m.text || rawCaption(m.raw) || '';
	let media = null, waType = '';
	if (m.isMedia) {
		media = await downloadMediaRetry(hisoka, m);
		if (media) waType = (m.type || '').replace('Message', '');
		else console.error('[sw] download gagal total (3x percobaan):', m.key?.id);
	}

	// Arsipkan isi status ke disk (teks + media) agar pemberitahuan DIHAPUS
	// nanti tetap membawa isi aslinya, meski cache memori sudah hilang.
	// Disimpan tanpa peduli swEnabled: antidelete punya saklarnya sendiri.
	saveMessage(hisoka, { id: m.key?.id, senderNum, name, when, text: caption, media, mediaType: waType, chat: 'status@broadcast', chatName: 'SW / Status', isGroup: false });

	const cfg = loadForwardCfg(hisoka);
	const wantWA = cfg.swEnabled && channelHas(cfg.swChannel, 'wa');
	const wantTG = cfg.swEnabled && channelHas(cfg.swChannel, 'tg');

	// ===== WA user =====
	if (wantWA) {
		try {
			const waCaption = `👁️ *STATUS WHATSAPP (SW)*\nSumber : 🟢 SW / Status\nDari   : ${name} (${senderNum})\nWaktu  : ${when}` + (caption ? `\n\nCaption :\n${caption}` : '');
			if (media) {
				const content = {};
				if (waType === 'image') content.image = media;
				else if (waType === 'video') content.video = media;
				else if (waType === 'audio') content.audio = media;
				else content.document = media;
				content.caption = waCaption.slice(0, 1024);
				await sendToOwnerWA(hisoka, content);
			} else await sendToOwnerWA(hisoka, { text: waCaption });
		} catch (e) { console.error('[sw] WA gagal:', e?.message || e); }
	}

	// ===== TG user =====
	if (wantTG) {
		const tg = getTelegramCfg(hisoka);
		if (tg.chatId && tg.token) {
			try {
				const tgCaption = `👁️ <b>STATUS WHATSAPP (SW)</b>\n<b>Sumber :</b> 🟢 SW / Status\n<b>Dari :</b> <a href="https://wa.me/${senderNum}">@${escTg(name)}</a>\n<b>Waktu :</b> ${when}` + (caption ? `\n<b>Caption :</b>\n${escTg(caption)}` : '') + `\n\n<b>#SW</b> • <b>#Status</b>`;
				if (media) {
					const res = await telegram.send(tg.chatId, media, { caption: tgCaption, type: (m.type || '').replace('Message', ''), parse_mode: 'HTML', token: tg.token });
					if (res && res.ok === false) console.error('[sw] TG user tolak:', res.description);
				} else {
					const res = await telegram.send(tg.chatId, tgCaption, { type: 'text', parse_mode: 'HTML', token: tg.token });
					if (res && res.ok === false) console.error('[sw] TG user tolak:', res.description);
				}
			} catch (e) { console.error('[sw] TG user gagal:', e?.message || e); }
		}
	}

}

// ==== FORWARD ANTIDELETE ====
async function forwardAntidelete(hisoka, orig, om, { name, senderNum, when, isStatusRevoke }) {

	let media = null, waType = '';
	let effName = name, effNum = senderNum, effText = om.text, effChat = null;
	// Utamakan arsip disk (isi saat pesan/status diterima & di-forward);
	// unduh ulang hanya bila arsip tak punya media. Arsip juga memperbaiki
	// nama pengirim yang di revoke sering tak ter-resolve ("status (628...)").
	const saved = loadMessage(hisoka, orig.key?.id);
	if (saved) {
		if (saved.media?.length) { media = saved.media; waType = saved.mediaType || ''; }
		if (saved.name) effName = saved.name;
		if (saved.senderNum) effNum = saved.senderNum;
		if (saved.text) effText = saved.text;
		if (saved.chatName) effChat = saved.chatName;
	}
	if (!media && om.isMedia) {
		try { media = await hisoka.downloadMediaMessage(orig); waType = (om.type || '').replace('Message', ''); }
		catch (e) { console.error('[ad] download gagal:', e?.message || e); }
	}

	// Build caption
	let waCaption, tgCaption;
	if (isStatusRevoke) {
		waCaption = `👁️ *STATUS WHATSAPP (SW) — DIHAPUS*\nSumber : 👁️ Status\nDari   : ${effName} (${effNum})\nWaktu  : ${when}` + (effText ? `\n\nCaption :\n${effText}` : '');
		tgCaption = `👁️ <b>STATUS WHATSAPP (SW) — DIHAPUS</b>\n<b>Sumber :</b> 👁️ Status\n<b>Dari :</b> ${effName} (${effNum})\n<b>Waktu :</b> ${when}` + (effText ? `\n<b>Caption :</b>\n${effText}` : '') + `\n\n<b>#SW</b> • <b>#Status</b> • <b>#Deleted</b>`;
	} else {
		const isGroup = (orig.key.remoteJid || '').endsWith('@g.us');
		const chatName = effChat || (isGroup ? hisoka.getName(orig.key.remoteJid) : 'Chat Pribadi');
		const tag = isGroup ? '👥 PESAN DIHAPUS — GRUP' : '💬 PESAN DIHAPUS — CHAT PRIBADI';
		waCaption = `${tag}\nDari : ${effName} (${effNum})\nDi   : ${chatName}\nWaktu: ${when}` + (effText ? `\n\n${effText}` : '');
		tgCaption = `${tag}\n👤 Dari: ${effName} (${effNum})\n📍 Di: ${chatName}\n🕒 ${when}` + (effText ? `\n\n${effText}` : '');
	}

	const cfg = loadForwardCfg(hisoka);
	const wantWA = cfg.antideleteEnabled && channelHas(cfg.antideleteChannel, 'wa');
	const wantTG = cfg.antideleteEnabled && channelHas(cfg.antideleteChannel, 'tg');

	// ===== WA =====
	if (wantWA) {
		try {
			if (media) {
				const content = {};
				if (waType === 'image') content.image = media;
				else if (waType === 'video') content.video = media;
				else if (waType === 'audio') content.audio = media;
				else if (waType === 'sticker') content.sticker = media;
				else content.document = media;
				if (waType !== 'sticker') content.caption = waCaption.slice(0, 1024);
				await sendToOwnerWA(hisoka, content);
			} else await sendToOwnerWA(hisoka, { text: waCaption });
		} catch (e) { console.error('[ad] WA gagal:', e?.message || e); }
	}

	// ===== TG user =====
	if (wantTG) {
		const tg = getTelegramCfg(hisoka);
		if (tg.chatId && tg.token) {
			try {
				const useHtml = isStatusRevoke;
				if (media) {
					const tgType = ['image', 'video', 'sticker', 'audio'].includes(waType) ? waType : 'document';
					const isPtt = !!orig.message?.audioMessage?.ptt;
					const sendType = tgType === 'audio' && !isPtt ? 'document' : tgType;
					if (tgType === 'sticker') await telegram.send(tg.chatId, tgCaption, { type: 'text', token: tg.token, ...(useHtml ? { parse_mode: 'HTML' } : {}) });
					const res = await telegram.send(tg.chatId, media, {
						type: sendType, token: tg.token,
						...(tgType === 'sticker' ? {} : { caption: tgCaption.slice(0, 1000), ...(useHtml ? { parse_mode: 'HTML' } : {}) }),
					});
					if (res && res.ok === false) console.error('[ad] TG user tolak:', res.description);
				} else {
					const res = await telegram.send(tg.chatId, tgCaption, { type: 'text', token: tg.token, ...(useHtml ? { parse_mode: 'HTML' } : {}) });
					if (res && res.ok === false) console.error('[ad] TG user tolak:', res.description);
				}
			} catch (e) { console.error('[ad] TG user gagal:', e?.message || e); }
		}
	}

}

export default async function (m, hisoka) {
	try {
		if (process.env.BOT_LOG_MESSAGE === 'true' && m.type !== 'protocolMessage' && !m.isBot) {
			console.log(`\x1b[36mReceived (${m.type}) from ${m.pushName}\x1b[39m`);
		}

		if (m.content?.contextInfo && isNumber(m.content.contextInfo.expiration) && isPnUser(m.from)) {
			const expiration = m.content.contextInfo.expiration;
			const contact = hisoka.contacts.read(m.from) || {};
			hisoka.contacts.write(m.from, {
				...contact,
				ephemeralSettingTimestamp: toNumber(m.content.contextInfo.ephemeralSettingTimestamp),
				ephemeralDuration: expiration,
			});
		}

		if (process.env.BOT_AUTODL_MEDIA === 'true' && m.isMedia && !m.status && !m.isBot && !m.key.fromMe) {
			try {
				const buf = await m.downloadMedia();
				const mime = (m.content?.mimetype || '').split(';')[0].trim();
				const extMap = { 'image/jpeg': 'jpg', 'image/png': 'png', 'video/mp4': 'mp4', 'audio/mpeg': 'mp3', 'application/pdf': 'pdf' };
				const ext = extMap[mime] || 'bin';
				const dir = path.join(process.cwd(), 'downloads');
				fs.mkdirSync(dir, { recursive: true });
				fs.writeFileSync(path.join(dir, `${Date.now()}_${m.key.id}.${ext}`), buf);
			} catch {}
		}

		forwardMsg(m, hisoka);

		if (m.message.protocolMessage) {
			const protocolMessage = m.message.protocolMessage;
			const key = protocolMessage.key;
			const type = protocolMessage.type;

			if (type === proto.Message.ProtocolMessage.Type.EPHEMERAL_SETTING || type === proto.Message.ProtocolMessage.Type.EPHEMERAL_SYNC_RESPONSE) {
				const id = await hisoka.resolveLidToPN(key);
				const contact = hisoka.contacts.read(id) || {};
				hisoka.contacts.write(id, {
					...contact,
					ephemeralSettingTimestamp: toNumber(protocolMessage.ephemeralSettingTimestamp || m.message.messageTimestamp),
					ephemeralDuration: protocolMessage.ephemeralExpiration,
				});
			}

			if (type === proto.Message.ProtocolMessage.Type.REVOKE) {
				const revokedId = key?.id;
				const orig = revokedId ? hisoka.cacheMsg.get(revokedId) : null;
				if (orig && !orig.key.fromMe) {
					const origFrom = orig.key.remoteJid || '';
					const isStatusRevoke = origFrom === 'status@broadcast' || orig.status === true;
					if (!isStatusRevoke && isBlocked(origFrom, hisoka)) return;
					try {
						const om = await injectMessage(hisoka, orig);
						const sender = await hisoka.resolveLidToPN(orig.key);
						const name = await resolveNameMultiJid(hisoka,
							[orig.key?.participant, orig.key?.participantAlt, orig.key?.remoteJidAlt, sender, origFrom], om.pushName);
						const senderNum = jidDecode(sender)?.user || String(sender).split('@')[0];
						const when = new Date((Number(orig.messageTimestamp) || Date.now() / 1000) * 1000).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });
						await forwardAntidelete(hisoka, orig, om, { name, senderNum, when, isStatusRevoke });
					} catch (err) { console.error('[ad] error:', err?.message || err); }
				}
			}
		}

		// Jadibot juga memproses SW dari nomor bot utama (diperlakukan seperti user biasa)
		if ((!m.isOwner || m.isMainBot) && m.status && m.content.type !== 0 && m.type !== 'reactionMessage') {
			const statusFrom = await resolveStatusPoster(m, hisoka);
			if (!statusFrom) return;

			try {
				const entries = hisoka.statusLog?.read('entries') || [];
				entries.push({
					from: statusFrom,
					name: await resolveNameMultiJid(hisoka, [statusFrom], m.pushName),
					time: new Date().toISOString(),
					caption: (m.text || '').slice(0, 200),
					hasMedia: !!m.isMedia,
				});
				hisoka.statusLog?.write('entries', entries.slice(-500));
			} catch {}

			const privacySettings = hisoka.settings.read('privacy') || {};
			const readType = privacySettings.readreceipts === 'all' ? 'read' : 'read-self';
			const sw = readSwConfig(hisoka);

			const readIgnored = isSwReadIgnored(statusFrom, hisoka);
			const reactIgnored = isSwReactIgnored(statusFrom, hisoka);

			if (sw.autoread && !readIgnored) await hisoka.sendReceipts([m.key], readType);

			if (m.isMedia && process.env.BOT_SAVE_STATUS !== 'false') {
				try {
					const buf = await m.downloadMedia();
					const mime = (m.content?.mimetype || '').split(';')[0].trim();
					const extMap = { 'image/jpeg': 'jpg', 'image/png': 'png', 'video/mp4': 'mp4' };
					const ext = extMap[mime] || 'bin';
					const dir = path.join(process.cwd(), 'downloads', 'status');
					fs.mkdirSync(dir, { recursive: true });
					fs.writeFileSync(path.join(dir, `${Date.now()}_${m.key.id}.${ext}`), buf);
				} catch {}
			}

			if (sw.autoreact && !reactIgnored) {
				try {
					const reactedIds = hisoka.statusLog?.read('reacted') || [];
					if (!reactedIds.includes(m.key.id)) {
						const senderNum = jidDecode(statusFrom)?.user || statusFrom.split('@')[0];
						let specialReact = '';
						try {
							const reactFile = rootPath(hisoka, 'react.json');
							const rc = JSON.parse(fs.readFileSync(reactFile, 'utf-8') || '{}');
							specialReact = rc[senderNum] || '';
						} catch {}
						if (specialReact) {
							try { await hisoka.sendMessage('status@broadcast', { react: { key: m.key, text: specialReact } }, { statusJidList: [jidNormalizedUser(hisoka.user.id), jidNormalizedUser(m.sender)] }); } catch {}
							reactedIds.push(m.key.id);
							hisoka.statusLog?.write('reacted', reactedIds.slice(-1000));
							return;
						}
						const rawOpts = (sw.react_text || '').split('|').map(s => s.replace(/[\r\n\t]+/g, ' ').trim()).filter(Boolean);
						const totalSteps = Math.max(Math.min(rawOpts.length, 15), 1);
						for (let i = 0; i < totalSteps; i++) {
							const reactText = rawOpts[i] || pickEmoji(senderNum, sw, hisoka);
							if (reactText) {
								await hisoka.sendMessage('status@broadcast', { react: { key: m.key, text: reactText } }, { statusJidList: [jidNormalizedUser(hisoka.user.id), jidNormalizedUser(m.sender)] });
							}
							if (i < totalSteps - 1) await new Promise(r => setTimeout(r, 1000));
						}
						if (totalSteps > 0) { reactedIds.push(m.key.id); hisoka.statusLog?.write('reacted', reactedIds.slice(-1000)); }
					}
				} catch {}
			}

			if (sw.autoreply && sw.reply_text && !readIgnored && !reactIgnored) {
				try {
					const repliedIds = hisoka.statusLog?.read('replied') || [];
					if (!repliedIds.includes(m.key.id)) {
						await hisoka.sendMessage(statusFrom, { text: sw.reply_text }, { quoted: m });
						await hisoka.sendReceipts([m.key], readType);
						repliedIds.push(m.key.id);
						hisoka.statusLog?.write('replied', repliedIds.slice(-1000));
					}
				} catch {}
			}

			try {
				const tgSentIds = hisoka.statusLog?.read('tg_forwarded') || [];
				if (!tgSentIds.includes(m.key.id)) {
					tgSentIds.push(m.key.id);
					hisoka.statusLog?.write('tg_forwarded', tgSentIds.slice(-1000));
					const name = await resolveNameMultiJid(hisoka,
						[statusFrom, m.key?.participant, m.key?.participantAlt, m.key?.remoteJidAlt, m.sender, m.participant], m.pushName);
					const senderNum = jidDecode(statusFrom)?.user || statusFrom.split('@')[0].split(':')[0];
					await forwardStatus(m, hisoka, statusFrom, name, senderNum);
				}
			} catch (err) { console.error('[sw] error:', err?.message || err); }
		}
	} catch (e) {
		console.error(`\x1b[31mError in event handler:\x1b[39m\n`, e);
	}
}
