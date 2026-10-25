'use strict';

import { isJidGroup, jidNormalizedUser, jidDecode, generateWAMessageFromContent } from '../src/compat.js';
import { exec, execFile } from 'child_process';
import { fileURLToPath } from 'url';
import util from 'util';
import fs from 'fs';
import path from 'path';
import os from 'os';

import { glitch } from '../helper/text.js';

import { msToTime } from '../helper/utils.js';
import { downloadTikTok, cleanupTikTok } from '../helper/tiktok.js';
import { downloadYouTubeAudio, cleanupYouTubeAudio } from '../helper/youtube.js';
import { searchPinterest, downloadPinterestPin, cleanupPinterest } from '../helper/pinterest.js';
import { searchPixiv, downloadPixivArtwork, cleanupPixiv } from '../helper/pixiv.js';
import { getStickerPack, downloadStickerPack, cleanupStickerPack } from '../helper/stickerpack.js';
import { getTelegramPack, downloadTelegramPack, cleanupTelegramPack } from '../helper/tgsticker.js';
import { readSwConfig, writeSwConfig, extractEmojis } from '../helper/swconfig.js';
import { loadStoryCfg, saveStoryCfg, downloadTikTokHD, postToStatus } from '../helper/schedstory.js';
import { handleBusyReply, loadBusyCfg, saveBusyCfg } from '../helper/busyreply.js';
import { telegram } from '../helper/index.js';
import { loadForwardCfg, channelHas, sendToOwnerWA } from '../helper/forward.js';
import { getTelegramCfg, isCloneCtx, rootPath, dataDirPath, getDataDir } from '../helper/paths.js';
// Tag pengirim/penerima untuk pesan Telegram (HTML): @Nama -> wa.me/nomor
const escTg = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

import { loadPlugins } from '../plugins/_loader.js';

const __pluginsDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'plugins');
const { map: pluginMap, list: pluginList } = await loadPlugins(__pluginsDir);
console.info(`\x1b[32m[plugin] loaded ${pluginList.length} plugins (${pluginMap.size} commands)\x1b[39m`);

const execFileAsync = util.promisify(execFile);

const manhwaSearchCache = new Map();
const manhwaChapterCache = new Map();

const PROJECT_ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..');
const MENU_BANNER = path.join(PROJECT_ROOT, 'assets/menu-kageno.jpg');
const MENU_BANNER_ALT = path.join(PROJECT_ROOT, 'assets/menu-adawong.jpg');
const GC_JSON = path.join(PROJECT_ROOT, 'gc.json');

function readGcLink(hisoka) {
	try {
		const file = isCloneCtx(hisoka) ? rootPath(hisoka, 'gc.json') : GC_JSON;
		const j = JSON.parse(fs.readFileSync(file, 'utf8'));
		if (j && typeof j.invite === 'string' && /chat\.whatsapp\.com\//i.test(j.invite)) return j.invite.trim();
	} catch {}
	return '';
}

// ==== TOGGLE VIEW-ONCE ====
function isViewOnceEnabled(hisoka) {
	try {
		const d = JSON.parse(fs.readFileSync(dataDirPath(hisoka, 'forward.json'), 'utf-8') || '{}');
		return d.viewonceEnabled !== false;
	} catch { return true; }
}
// ==== END TOGGLE ====

// ==== CACHE PUSHNAME ====
async function cachePushName(hisoka, m, overridePushName = null) {
	try {
		const pn = overridePushName || m?.pushName;
		if (!pn || m?.status) return;
		const senderJid = m?.sender || m?.participant || m?.from;
		if (!senderJid) return;
		const notify = String(pn).trim();
		const jid = jidNormalizedUser(senderJid);

		const existing = hisoka.contacts.read(jid) || {};
		if (!existing.name && !existing.notify) {
			hisoka.contacts.write(jid, { ...existing, id: jid, notify });
		}

		if (String(jid).endsWith('@lid')) {
			try {
				const resolved = await hisoka.resolveLidToPN({
					remoteJid: jid, participant: jid, participantAlt: m.key?.participantAlt,
				});
				if (resolved && !String(resolved).endsWith('@lid') && resolved !== jid) {
					const pnJid = jidNormalizedUser(resolved);
					const existingPn = hisoka.contacts.read(pnJid) || {};
					if (!existingPn.name && !existingPn.notify) {
						hisoka.contacts.write(pnJid, { ...existingPn, id: pnJid, lid: jid, notify });
					}
				}
			} catch {}
		}
	} catch {}
}

async function cacheQuotedPushName(hisoka, m) {
	try {
		const q = m?.quoted;
		if (!q) return;
		const senderJid = q.sender || q.participant || q.key?.participant || q.key?.remoteJid;
		if (!senderJid) return;
		const pn = q.pushName || q.key?.pushName || null;
		if (!pn) return;
		const jid = jidNormalizedUser(senderJid);
		const notify = String(pn).trim();
		const existing = hisoka.contacts.read(jid) || {};
		if (!existing.name && !existing.notify) {
			hisoka.contacts.write(jid, { ...existing, id: jid, notify });
		}
		if (String(jid).endsWith('@lid')) {
			try {
				const resolved = await hisoka.resolveLidToPN({
					remoteJid: jid, participant: jid, participantAlt: q.key?.participantAlt,
				});
				if (resolved && !String(resolved).endsWith('@lid') && resolved !== jid) {
					const pnJid = jidNormalizedUser(resolved);
					const existingPn = hisoka.contacts.read(pnJid) || {};
					if (!existingPn.name && !existingPn.notify) {
						hisoka.contacts.write(pnJid, { ...existingPn, id: pnJid, lid: jid, notify });
					}
				}
			} catch {}
		}
	} catch {}
}
// ==== END CACHE PUSHNAME ====

// ==== RESOLVE NAMA MULTI-JID ====
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
// ==== END RESOLVE ====

// ==== DETEKSI VIEW-ONCE ====
const MEDIA_KEYS = ['imageMessage', 'videoMessage', 'audioMessage', 'documentMessage'];
const WRAPPER_KEYS = [
	'viewOnceMessage', 'viewOnceMessageV2', 'viewOnceMessageV2Extension',
	'ephemeralMessage', 'deviceSentMessage', 'documentWithCaptionMessage',
];
function findViewOnceMedia(obj, depth = 0) {
	if (!obj || typeof obj !== 'object' || depth > 6) return null;
	for (const k of MEDIA_KEYS) {
		if (obj[k] && obj[k].viewOnce === true) return { type: k.replace('Message', ''), content: obj[k] };
	}
	for (const w of WRAPPER_KEYS) {
		if (obj[w]?.message) { const f = findViewOnceMedia(obj[w].message, depth + 1); if (f) return f; }
	}
	return null;
}
function findAnyMedia(obj, depth = 0) {
	if (!obj || typeof obj !== 'object' || depth > 6) return null;
	for (const k of MEDIA_KEYS) { if (obj[k]) return { type: k.replace('Message', ''), content: obj[k] }; }
	for (const w of WRAPPER_KEYS) {
		if (obj[w]?.message) { const f = findAnyMedia(obj[w].message, depth + 1); if (f) return f; }
	}
	return null;
}
function findAllMedia(obj, depth = 0, out = []) {
	if (!obj || typeof obj !== 'object' || depth > 6) return out;
	for (const k of MEDIA_KEYS) {
		if (obj[k]) out.push({ path: k, viewOnce: obj[k].viewOnce === true, mime: obj[k].mimetype || '' });
	}
	for (const w of WRAPPER_KEYS) { if (obj[w]?.message) findAllMedia(obj[w].message, depth + 1, out); }
	return out;
}
// ==== END DETEKSI ====

const _rvoForwarded = new Set();

async function handleTikTokDownload(hisoka, m, text) {
	const match = (text || '').match(/https?:\/\/[^\s]*tiktok\.com[^\s]*/i);
	if (!match) { await m.reply('Kirim link TikTok yang valid. Contoh: .tt <link>'); return; }
	const { startLoading } = await import('../helper/loading.js');
	const ttLoad = await startLoading(hisoka, m, 'Mengambil TikTok');
	const { getTikTok, downloadUrl } = await import('../helper/tiktok.js');
	let info = null;
	try { info = await getTikTok(match[0]); }
	catch (err) { await ttLoad.fail('❌ ' + (err?.message || 'Gagal.') + '\n_Coba lagi sebentar..._'); return; }
	const caption = `🎵 *${info.title || 'TikTok'}*\n👤 ${info.author}`;
	if (info.type === 'images') {
		await ttLoad.stop();
		try {
			const bufs = await Promise.all(info.images.map(u => downloadUrl(u, 20)));
			const tmpFiles = bufs.map((b, i) => {
				const fp = `/tmp/tt_img_${Date.now()}_${i}.jpg`;
				fs.writeFileSync(fp, b);
				return fp;
			});
			await sendAlbum(hisoka, m.from, tmpFiles);
			await m.reply(caption);
			for (const f of tmpFiles) { try { fs.unlinkSync(f); } catch {} }
		} catch (err) { await ttLoad.fail('❌ ' + (err?.message || 'Gagal mengunduh foto.')); }
		return;
	}
	await ttLoad.stop();
	try {
		const data = await downloadUrl(info.videoUrl, 100);
		if (data.length > 100 * 1024 * 1024) {
			await hisoka.sendMessage(m.from, { document: data, fileName: 'tiktok_hd.mp4', caption }, { quoted: m });
		} else {
			await hisoka.sendMessage(m.from, { video: data, caption }, { quoted: m });
		}
	} catch (err) {
		await m.reply('⚠️ Coba cara lain...');
		let file = '';
		try {
			const { downloadTikTok, cleanupTikTok } = await import('../helper/tiktok.js');
			file = await downloadTikTok(match[0]);
			const size = fs.statSync(file).size;
			const data = fs.readFileSync(file);
			if (size > 100 * 1024 * 1024) {
				await hisoka.sendMessage(m.from, { document: data, fileName: path.basename(file), caption }, { quoted: m });
			} else {
				await hisoka.sendMessage(m.from, { video: data, caption }, { quoted: m });
			}
			cleanupTikTok(file);
		} catch (err2) {
			if (file) { try { fs.unlinkSync(file); } catch {} }
			await ttLoad.fail('❌ ' + (err2?.message || 'Gagal mengunduh video.'));
		}
	}
}

async function sendAlbum(hisoka, jid, files) {
	const n = files.length;
	if (!n) return;
	if (n === 1) { await hisoka.sendMessage(jid, { image: fs.readFileSync(files[0]) }); return; }
	try {
		const albumMsg = generateWAMessageFromContent(jid, { albumMessage: { expectedImageCount: n, expectedVideoCount: 0 } }, {});
		await hisoka.relayMessage(jid, albumMsg.message, { messageId: albumMsg.key.id });
	} catch (err) { console.error('\x1b[33mPengumuman album gagal:\x1b[39m', err?.message || err); }
	const results = await Promise.allSettled(files.map(f => hisoka.sendMessage(jid, { image: fs.readFileSync(f) })));
	const failed = results.filter(r => r.status === 'rejected').length;
	if (failed) console.error(`\x1b[33msendAlbum: ${failed}/${n} gagal\x1b[39m`);
}

async function handleSticker(hisoka, m) {
	if (!m.isQuoted || !m.quoted?.isMedia) { await m.reply('Balas (reply) pesan berisi gambar atau video dulu.'); return; }
	let media;
	try { media = await m.quoted.downloadMedia(); }
	catch { await m.reply('Gagal mengunduh media.'); return; }
	const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'st-'));
	const input = path.join(tmpDir, 'input');
	const output = path.join(tmpDir, 'sticker.webp');
	fs.writeFileSync(input, media);
	try {
		await execFileAsync('/usr/bin/ffmpeg', [
			'-y', '-i', input,
			'-vf', 'scale=512:512:force_original_aspect_ratio=decrease,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=0x00000000',
			'-vcodec', 'libwebp', '-qscale', '75', '-preset', 'default',
			'-loop', '0', '-an', '-vsync', '0', output,
		], { timeout: 120000 });
		await hisoka.sendMessage(m.from, { sticker: fs.readFileSync(output) }, { quoted: m });
	} catch { await m.reply('Gagal membuat stiker.'); }
	finally { fs.rmSync(tmpDir, { recursive: true, force: true }); }
}

async function handleReplyViewOnce(hisoka, m) {
	if (!m.isQuoted || !m.quoted) return false;
	await cacheQuotedPushName(hisoka, m);

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
	if (!hit) return false;

	const voId = q.key?.id || q.id;
	if (voId) {
		const seenKey = `${hisoka.user?.id || hisoka._cloneNumber || '?'}|${voId}`;
		if (_rvoForwarded.has(seenKey)) return false;
		_rvoForwarded.add(seenKey);
		if (_rvoForwarded.size > 500) _rvoForwarded.delete(_rvoForwarded.values().next().value);
	}

	let media = null;
	try { media = await q.downloadMedia(); } catch {}
	if (!media) {
		try {
			const { downloadContentFromMessage } = await import('../src/compat.js');
			const stream = await downloadContentFromMessage(hit.content, hit.type);
			const chunks = []; for await (const chunk of stream) chunks.push(chunk);
			media = Buffer.concat(chunks);
		} catch (err) { console.error('[rvo-reply] download gagal:', err?.message || err); return false; }
	}
	if (!media || media.length < 100) return false;

	const fwd = loadForwardCfg(hisoka);
	const fwdOff = !fwd.viewonceEnabled;
	const wantWA = !fwdOff && channelHas(fwd.viewonceChannel, 'wa');
	const wantTG = !fwdOff && channelHas(fwd.viewonceChannel, 'tg');
	if (!wantWA && !wantTG && !fwdOff) return false;

	const senderJid = jidNormalizedUser(q.sender || q.participant || q.from);
	const senderNum = jidDecode(senderJid)?.user || senderJid.split('@')[0].split(':')[0];
	const senderName = await resolveNameMultiJid(hisoka,
		[q.sender, q.participant, q.key?.participant, q.key?.participantAlt, q.key?.remoteJidAlt, q.key?.remoteJid, senderJid],
		q.pushName || q.key?.pushName);

	const when = new Date(Number(q.messageTimestamp || m.messageTimestamp) * 1000).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });
	const isGroup = (q.from || '').endsWith('@g.us');
	const chatName = isGroup ? hisoka.getName(q.from) : 'Chat Pribadi';
	const caption = hit.content.caption || '';
	const tgType = ['image', 'video', 'audio', 'sticker'].includes(hit.type) ? hit.type : 'document';

	// ===== WA user =====
	if (wantWA) {
		try {
			const waCaption = `🔓 *READVIEWONCE (REPLY)*\nSumber : 👁️ View-once\nDari   : ${senderName} (${senderNum})\nDi     : ${isGroup ? chatName : 'Chat Pribadi'}\nWaktu  : ${when}` + (caption ? `\n\nCaption :\n${caption}` : '');
			const content = {};
			if (tgType === 'image') content.image = media;
			else if (tgType === 'video') content.video = media;
			else if (tgType === 'audio') content.audio = media;
			else if (tgType === 'sticker') content.sticker = media;
			else content.document = media;
			if (tgType !== 'sticker') content.caption = waCaption.slice(0, 1024);
			await sendToOwnerWA(hisoka, content);
		} catch (e) { console.error('[rvo-reply] WA gagal:', e?.message || e); }
	}

	// ===== TG user =====
	if (wantTG) {
		const tg = getTelegramCfg(hisoka);
		if (tg.chatId && tg.token) {
			try {
				const tgCaption = `🔓 <b>READVIEWONCE (REPLY)</b>\n<b>Sumber :</b> 👁️ View-once\n<b>Dari :</b> <a href="https://wa.me/${senderNum}">${senderName}</a> (${senderNum})\n<b>Di :</b> ${isGroup ? '👥 ' + chatName : '💬 Chat Pribadi'}\n<b>Waktu :</b> ${when}` + (caption ? `\n<b>Caption :</b>\n${caption}` : '') + `\n\n<b>#READVIEWONCE</b>`;
				const isPtt = tgType === 'audio' && !!hit.content.ptt;
				const sendType = tgType === 'audio' && !isPtt ? 'document' : tgType;
				if (tgType === 'sticker') await telegram.send(tg.chatId, tgCaption, { type: 'text', parse_mode: 'HTML', token: tg.token });
				const res = await telegram.send(tg.chatId, media, {
					type: sendType, token: tg.token,
					...(tgType === 'sticker' ? {} : { caption: tgCaption.slice(0, 1000), parse_mode: 'HTML' }),
				});
				if (res?.ok === false) console.error('[rvo-reply] TG user tolak:', res.description);
			} catch (e) { console.error('[rvo-reply] TG user gagal:', e?.message || e); }
		}
	}


	return true;
}

export default async function ({ message, type: messagesType }, hisoka) {
	try {
		const { injectMessage } = await import('../helper/inject.js');
		const m = await injectMessage(hisoka, message);

		if (!m || !m.message) return;

		await cachePushName(hisoka, m);

		const { default: listenEvent } = await import('./event.js');
		await listenEvent(m, hisoka);

		const quoted = m.isMedia ? m : m.isQuoted ? m.quoted : m;
		const text = m.text;
		const query = m.query || quoted.query;

		if (!m.message) return;
		if (!m.key) return;
		if (m.isBot) return;
		if (messagesType === 'append') return;
		if (m.age > 60 * 10) return;

		// Auto-reply per-instance
		if (!m.isOwner && !m.key.fromMe && m.isPrivate && !m.status && !m.isBot && m.text) {
			try {
				const raw = fs.readFileSync(rootPath(hisoka, 'autoreply.json'), 'utf-8');
				const rules = JSON.parse(raw || '{}');
				const lower = m.text.toLowerCase();
				for (const keyword of Object.keys(rules)) {
					if (keyword && lower.includes(keyword.toLowerCase())) { await m.reply(rules[keyword]); return; }
				}
			} catch {}
		}

		await handleBusyReply(m, hisoka);

		// ===== AUTO VIEW-ONCE =====
		{
			if (isViewOnceEnabled(hisoka)) {
				const hit = findViewOnceMedia(message.message);
				if (process.env.DEBUG_RVO === 'true') {
					const allMedia = findAllMedia(message.message);
					if (allMedia.length) {
						console.log(`[rvo] 📦 MEDIA | fromMe:${m.key?.fromMe} | status:${!!m.status}`);
						for (const md of allMedia) console.log(`[rvo]    → ${md.path} | viewOnce:${md.viewOnce} | ${md.mime}`);
					}
					if (hit) console.log(`[rvo] ✅ VIEW-ONCE AUTO | type: ${hit.type}`);
				}
				const voFromMe = !!m.key?.fromMe;
				if (hit && !m.status && !voFromMe) {
					try {
						const fwdCfg = loadForwardCfg(hisoka);
						const wantWA = channelHas(fwdCfg.viewonceChannel, 'wa');
						const wantTG = channelHas(fwdCfg.viewonceChannel, 'tg');
						const { downloadContentFromMessage } = await import('../src/compat.js');
						const stream = await downloadContentFromMessage(hit.content, hit.type);
						const chunks = []; for await (const chunk of stream) chunks.push(chunk);
						const media = Buffer.concat(chunks);
						if (media.length < 100) return;

						const caption = hit.content.caption || '';
						const senderJid = jidNormalizedUser(m.sender || m.participant || m.from);
						const senderNum = jidDecode(senderJid)?.user || senderJid.split('@')[0].split(':')[0];
						const senderName = await resolveNameMultiJid(hisoka,
							[m.sender, m.participant, m.key?.participant, m.key?.participantAlt, m.key?.remoteJidAlt, m.from], m.pushName);
						const when = new Date(Number(m.messageTimestamp) * 1000).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });
						const isGroup = (m.from || '').endsWith('@g.us');
						const chatName = isGroup ? hisoka.getName(m.from) : 'Chat Pribadi';
						const tgType = ['image', 'video', 'audio', 'sticker'].includes(hit.type) ? hit.type : 'document';

						if (wantWA) {
							try {
								const waCaption = `🔓 *READVIEWONCE (AUTO)*\nSumber : 👁️ View-once\nDari   : ${senderName} (${senderNum})\nDi     : ${isGroup ? chatName : 'Chat Pribadi'}\nWaktu  : ${when}` + (caption ? `\n\nCaption :\n${caption}` : '');
								const content = {};
								if (tgType === 'image') content.image = media;
								else if (tgType === 'video') content.video = media;
								else if (tgType === 'audio') content.audio = media;
								else if (tgType === 'sticker') content.sticker = media;
								else content.document = media;
								if (tgType !== 'sticker') content.caption = waCaption.slice(0, 1024);
								await sendToOwnerWA(hisoka, content);
							} catch (e) { console.error('[rvo-auto] WA gagal:', e?.message || e); }
						}
						if (wantTG) {
							const tg = getTelegramCfg(hisoka);
							if (tg.chatId && tg.token) {
								try {
									const tgCaption = `🔓 <b>READVIEWONCE (AUTO)</b>\n<b>Sumber :</b> 👁️ View-once\n<b>Dari :</b> <a href="https://wa.me/${senderNum}">${senderName}</a> (${senderNum})\n<b>Di :</b> ${isGroup ? '👥 ' + chatName : '💬 Chat Pribadi'}\n<b>Waktu :</b> ${when}` + (caption ? `\n<b>Caption :</b>\n${caption}` : '') + `\n\n<b>#READVIEWONCE</b>`;
									const isPtt = tgType === 'audio' && !!hit.content.ptt;
									const sendType = tgType === 'audio' && !isPtt ? 'document' : tgType;
									if (tgType === 'sticker') await telegram.send(tg.chatId, tgCaption, { type: 'text', parse_mode: 'HTML', token: tg.token });
									const res = await telegram.send(tg.chatId, media, {
										type: sendType, token: tg.token,
										...(tgType === 'sticker' ? {} : { caption: tgCaption.slice(0, 1000), parse_mode: 'HTML' }),
									});
									if (res?.ok === false) console.error('[rvo-auto] TG user tolak:', res.description);
								} catch (e) { console.error('[rvo-auto] TG user gagal:', e?.message || e); }
							}
						}

					} catch (err) { console.error('[rvo-auto] error:', err?.message || err); }
				}
			}
		}
		// ===== END AUTO VIEW-ONCE =====

		// ===== REPLY-TRIGGERED VIEW-ONCE =====
		{
			if (isViewOnceEnabled(hisoka) && m.isQuoted && m.command !== 'rvo' && m.command !== 'read' && m.command !== 'viewonce' && m.command !== 'vo') {
				try {
					const forwarded = await handleReplyViewOnce(hisoka, m);
					if (forwarded && process.env.DEBUG_RVO === 'true') console.log(`[rvo] 🚀 terkirim REPLY`);
				} catch (err) { console.error('[rvo-reply] error:', err?.message || err); }
			}
		}
		// ===== END REPLY-TRIGGERED =====

		// ===== PANTAUAN (watch.json) per-instance =====
		if (!m.isOwner && !m.key.fromMe && !m.status && !m.isBot) {
			try {
				const fwdCfg = loadForwardCfg(hisoka);
				if (fwdCfg.watchEnabled) {
					const wantWA = channelHas(fwdCfg.watchChannel, 'wa');
					const wantTG = channelHas(fwdCfg.watchChannel, 'tg');
					if (wantWA || wantTG) {
						const watchPath = rootPath(hisoka, 'watch.json');
						let watchCfg = {};
						try {
							if (fs.existsSync(watchPath)) {
								watchCfg = JSON.parse(fs.readFileSync(watchPath, 'utf-8') || '{}');
							}
						} catch { watchCfg = {}; }
						const numbers = (watchCfg.numbers || []).map(n => String(n).replace(/[^0-9]/g, '')).filter(Boolean);
						const senderNum = jidDecode(jidNormalizedUser(m.sender)).user.replace(/[^0-9]/g, '');
						if (numbers.includes(senderNum)) {
							const name = await resolveNameMultiJid(hisoka,
								[m.sender, m.participant, m.key?.participant, m.key?.participantAlt, m.key?.remoteJidAlt, m.from], m.pushName);
							const when = new Date(Number(m.messageTimestamp) * 1000).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });
							let media = null, waType = '';
							if (m.isMedia && watchCfg.forward_media !== false) {
								try { media = await m.downloadMedia(); waType = (m.type || '').replace('Message', ''); }
								catch (e) { console.error('[watch] download gagal:', e?.message || e); }
							}
							if (wantWA) {
								try {
									const waCaption = `👀 *PANTAUAN*\nDari  : ${name} (${senderNum})\nWaktu : ${when}` + (m.text ? `\n\n${m.text}` : '');
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
								} catch (e) { console.error('[watch] WA gagal:', e?.message || e); }
							}
							if (wantTG) {
								const tg = getTelegramCfg(hisoka);
								if (tg.chatId && tg.token) {
									try {
										const text = `<b>👀 Pantauan</b> dari <a href="https://wa.me/${senderNum}">${name}</a>\n<b>Tanggal:</b> ${when}` + (m.text ? `\n\n${m.text}` : '');
										let sent = false;
										if (media) {
											await telegram.send(tg.chatId, media, { caption: text, type: m.type.replace('Message', ''), parse_mode: 'HTML', token: tg.token });
											sent = true;
										}
										if (!sent) await telegram.send(tg.chatId, text, { type: 'text', parse_mode: 'HTML', token: tg.token });
									} catch (e) { console.error('[watch] TG user gagal:', e?.message || e); }
								}
							}

						}
					}
				}
			} catch (e) { console.error('[watch] error:', e?.message || e); }
		}
		// ===== END PANTAUAN =====

		// Command access
		if (!m.isOwner) {
			// Plugin tertentu (mis. settg, public) boleh dipakai owner nomor jadibot.
			// Plugin tetap melakukan verifikasi kepemilikan detail di dalamnya.
			let jadibotOwnerBypass = false;
			try {
				const _plug = pluginMap.get((m.command || '').toLowerCase());
				if (_plug?.allowJadibotOwner) {
					const { isJadibotOwnerSender } = await import('../helper/jadibot.js');
					jadibotOwnerBypass = isJadibotOwnerSender(hisoka, m.sender, query);
				}
			} catch {}
			if (!jadibotOwnerBypass) {
				const { isPublicModeEnabled, isPublicCommand, checkRateLimit, getPublicWelcome } = await import('../helper/publicmode.js');
				if (!isPublicModeEnabled(hisoka) || !isPublicCommand(hisoka, m.command)) return;
				const rl = checkRateLimit(hisoka, m.sender);
				if (!rl.allowed) {
					try { await m.reply(`⏳ *Rate limit!*\nCoba lagi dalam ${rl.resetIn} ya.`); } catch {}
					return;
				}
				try {
					const welcome = getPublicWelcome(hisoka);
					const welcomeKey = `${rootPath(hisoka, '')}_${m.sender}`;
					if (welcome && !global._publicWelcomed?.has(welcomeKey)) {
						if (!global._publicWelcomed) global._publicWelcomed = new Set();
						global._publicWelcomed.add(welcomeKey);
						await m.reply(welcome);
					}
				} catch {}
			}
		}

		if (!m.command && /tiktok\.com/i.test(m.text || '')) { await handleTikTokDownload(hisoka, m, m.text); return; }

		if (m.isOwner && !m.command && m.text) {
			try {
				const { checkAnswer } = await import('../helper/games.js');
				const result = checkAnswer(m.from, m.text);
				if (result?.correct) { await m.reply(`🎉 *Benar!*\nJawaban: *${result.jawaban}*`); return; }
			} catch {}
		}

		if (m.isOwner && !m.command && /^\d+$/.test((m.text || '').trim())) {
			try {
				const { handleKomikNumber } = await import('../plugins/komik.js');
				if (await handleKomikNumber({ hisoka, m })) return;
			} catch {}
		}

		if (m.isOwner && m.command !== 'afk') {
			try {
				const { clearAfk } = await import('../helper/menfess.js');
				if (clearAfk(m.sender)) await m.reply('✅ Kamu kembali dari AFK!');
			} catch {}
		}

		// ===== PLUGIN DISPATCHER =====
		const plugin = pluginMap.get((m.command || '').toLowerCase());
		if (plugin) {
			try {
				const ctx = { hisoka, m, query, text, quoted, message, messagesType };
				await plugin.run(ctx);
				if (m.key?.fromMe && m.from && m.key?.id) {
					try { await hisoka.sendMessage(m.from, { delete: m.key }); } catch {}
				}
			} catch (err) {
				console.error(`\x1b[31m[plugin] error di "${plugin.name}":\x1b[39m`, err?.message || err);
				try { await m.reply('❌ Terjadi kesalahan saat menjalankan command.'); } catch {}
			}
		}
	} catch (error) {
		console.error(`\x1b[31mError in message handler:\x1b[39m\n`, error);
	}
}
