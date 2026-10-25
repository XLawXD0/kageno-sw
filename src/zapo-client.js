'use strict';

// ============================================================
// zapo-client.js — Adapter zapo-js-mod -> antarmuka mirip Baileys.
//
// createBotClient() menghasilkan objek "hisoka" dengan permukaan API
// yang sama seperti socket Baileys lama (ev, sendMessage, user,
// groupMetadata, dll.), sehingga helper/inject.js, handler, dan
// plugins tidak perlu tahu bahwa library-nya sudah diganti.
//
// Library WhatsApp yang dipakai: zapo-js-mod (WaClient).
// Penyimpanan sesi: @zapo-js/store-sqlite (satu file state.sqlite
// per folder sesi) — format Baileys lama (creds.json dkk.) TIDAK
// kompatibel, jadi sesi harus pairing ulang sekali.
// ============================================================

import fs from 'fs';
import path from 'path';
import { EventEmitter } from 'events';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { WaClient, createStore, createNoopLogger } from 'zapo-js-mod';
import { createSqliteStore } from '@zapo-js/store-sqlite';
import { jidNormalizedUser, areJidsSameUser, isJidGroup } from './compat.js';

const delay = ms => new Promise(r => setTimeout(r, ms));

function proxyAgent() {
	const url = process.env.https_proxy || process.env.HTTPS_PROXY || '';
	return url ? new HttpsProxyAgent(url) : undefined;
}

/** Ambil media dari {url} / URL string / path file menjadi Buffer bila perlu. */
/** Tebak mimetype gambar dari magic bytes buffer (JPEG/PNG/GIF/WebP/BMP).
 *  Dipakai saat pengirim tidak menyertakan mimetype — zapo-js-mod menolak kirim
 *  gambar tanpa mimetype ("mimetype is required for image messages"). */
function detectImageMime(buf) {
	if (!buf) return null;
	const b = Buffer.isBuffer(buf) ? buf : (buf instanceof Uint8Array ? Buffer.from(buf) : null);
	if (!b || b.length < 4) return null;
	if (b[0] === 0xFF && b[1] === 0xD8) return 'image/jpeg';
	if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4E && b[3] === 0x47) return 'image/png';
	if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x38) return 'image/gif';
	if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b.length >= 12 && b.toString('ascii', 8, 12) === 'WEBP') return 'image/webp';
	if (b[0] === 0x42 && b[1] === 0x4D) return 'image/bmp';
	return null;
}

async function normalizeMedia(media) {
	if (!media) return media;
	if (Buffer.isBuffer(media) || media instanceof Uint8Array) return media;
	if (typeof media === 'object' && media.url) {
		const res = await fetch(media.url);
		if (!res.ok) throw new Error(`Gagal unduh media: HTTP ${res.status}`);
		return Buffer.from(await res.arrayBuffer());
	}
	if (typeof media === 'string') {
		if (/^https?:\/\//i.test(media)) {
			const res = await fetch(media);
			if (!res.ok) throw new Error(`Gagal unduh media: HTTP ${res.status}`);
			return Buffer.from(await res.arrayBuffer());
		}
		try {
			if (fs.existsSync(media)) return fs.readFileSync(media);
		} catch {}
		return media; // biarkan zapo menafsirkan string (path/url)
	}
	return media; // Readable stream dll.
}

/**
 * Ubah satu definisi tombol -> entri nativeFlowMessage.buttons (proto WA).
 * Bentuk yang diterima:
 * - mentah ala @neoxr/zapo: { name, buttonParamsJson | buttonParams | params }
 * - ramah: { type: 'reply'|'url'|'copy'|'call'|'list', text, id/url/code/phone/sections }
 * - Baileys lawas: { buttonId, buttonText: { displayText } }
 * - neoxr lawas: { text, command }
 */
function toFlowButton(b) {
	if (!b || typeof b !== 'object') return null;
	if (b.name) {
		const pj = b.buttonParamsJson ?? b.buttonParams ?? b.params;
		return { name: b.name, buttonParamsJson: typeof pj === 'string' ? pj : JSON.stringify(pj ?? {}) };
	}
	const display = b.text || b.displayText || b.title || b.label || '';
	if (b.buttonId || b.buttonText) {
		return { name: 'quick_reply', buttonParamsJson: JSON.stringify({ display_text: b.buttonText?.displayText || display, id: b.buttonId || display }) };
	}
	if (b.command) {
		return { name: 'quick_reply', buttonParamsJson: JSON.stringify({ display_text: display, id: b.command }) };
	}
	switch (b.type) {
		case 'url':
			return { name: 'cta_url', buttonParamsJson: JSON.stringify({ display_text: display, url: b.url, merchant_url: b.merchantUrl || b.url }) };
		case 'copy':
			return { name: 'cta_copy', buttonParamsJson: JSON.stringify({ display_text: display, ...(b.id ? { id: b.id } : {}), copy_code: String(b.code ?? b.copyCode ?? '') }) };
		case 'call':
			return { name: 'cta_call', buttonParamsJson: JSON.stringify({ display_text: display, phone_number: String(b.phone || b.number || '').replace(/[^0-9]/g, '') }) };
		case 'list':
			return { name: 'single_select', buttonParamsJson: JSON.stringify({ title: b.title || display || 'Pilih', sections: b.sections || [] }) };
		case 'reply':
		default:
			return { name: 'quick_reply', buttonParamsJson: JSON.stringify({ display_text: display, id: b.id || display }) };
	}
}

/**
 * Bangun proto pesan interaktif (tombol native flow) siap kirim via zapo.
 * Dibungkus viewOnceMessage + messageContextInfo — pola yang terbukti
 * tampil di WhatsApp Android/iOS saat ini. Ketukan quick_reply/list tiba
 * sebagai pesan teks berisi id-nya (sudah ditangani helper/inject.js),
 * jadi id berupa command (mis. '.menu') langsung mengeksekusi command itu.
 */
export function buildInteractiveMessage({ text = '', footer = '', title = '', buttons = [] } = {}) {
	const interactiveMessage = {
		...(title ? { header: { title: String(title), hasMediaAttachment: false } } : {}),
		body: { text: String(text ?? '') },
		...(footer ? { footer: { text: String(footer) } } : {}),
		nativeFlowMessage: { buttons: buttons.map(toFlowButton).filter(Boolean) },
	};
	return {
		viewOnceMessage: {
			message: {
				messageContextInfo: { deviceListMetadata: {}, deviceListMetadataVersion: 2 },
				interactiveMessage,
			},
		},
	};
}

function normKey(key = {}) {
	const out = {
		remoteJid: key.remoteJid || '',
		id: key.id || '',
		fromMe: !!key.fromMe,
	};
	if (key.participant) out.participant = key.participant;
	return out;
}

/** Petakan metadata grup zapo -> bentuk Baileys. */
function mapGroupMetadata(md) {
	if (!md) return md;
	return {
		id: md.jid,
		subject: md.subject,
		subjectOwner: md.subjectOwner,
		subjectTime: md.subjectTime,
		owner: md.ownerPhoneNumber || md.owner,
		creation: md.creation,
		desc: md.desc,
		descId: md.descId,
		descOwner: md.descOwner,
		descTime: md.descTime,
		restrict: md.restrict,
		announce: md.announce,
		ephemeralDuration: md.ephemeral,
		addressingMode: md.addressingMode,
		size: md.size,
		participants: (md.participants || []).map(p => ({
			id: p.jid,
			phoneNumber: p.phoneNumber,
			lid: p.lid,
			admin: p.isSuperAdmin ? 'superadmin' : p.isAdmin ? 'admin' : null,
		})),
	};
}

const PRIVACY_KEY_MAP = {
	readReceipts: 'readreceipts',
	lastSeen: 'last',
	online: 'online',
	profilePicture: 'profile',
	about: 'status',
	groupAdd: 'groupadd',
	callAdd: 'calladd',
};

/**
 * Buat klien bot.
 * @param {object} opts
 * @param {string} opts.sessionDir folder sesi (state.sqlite + marker disimpan di sini)
 * @param {string} [opts.sessionId] id sesi zapo (default: nama folder)
 * @param {object} [opts.logger] pino logger untuk hisoka.logger
 */
export function createBotClient({ sessionDir, sessionId, logger } = {}) {
	if (!sessionDir) throw new Error('createBotClient: sessionDir wajib diisi.');
	fs.mkdirSync(sessionDir, { recursive: true });

	const markerFile = path.join(sessionDir, 'zapo-paired.json');
	const readMarker = () => {
		try { return JSON.parse(fs.readFileSync(markerFile, 'utf-8')); } catch { return null; }
	};
	const writeMarker = data => {
		try { fs.writeFileSync(markerFile, JSON.stringify(data, null, 2)); } catch {}
	};

	const store = createStore({
		backends: {
			sqlite: createSqliteStore({ path: path.join(sessionDir, 'state.sqlite') }),
		},
		providers: {
			auth: 'sqlite',
			signal: 'sqlite',
			preKey: 'sqlite',
			session: 'sqlite',
			identity: 'sqlite',
			senderKey: 'sqlite',
			appState: 'sqlite',
			privacyToken: 'sqlite',
			messages: 'none',
			threads: 'none',
			contacts: 'none',
		},
	});

	const agent = proxyAgent();
	// Diagnostik koneksi: proxy env yang terbaca menentukan jalur soket zapo.
	// (URL proxy tidak dicetak — bisa berisi kredensial.)
	console.log(`[zapo] jalur koneksi: ${agent ? 'lewat proxy dari env https_proxy' : 'langsung (tanpa proxy)'}`);
	const client = new WaClient(
		{
			store,
			sessionId: sessionId || path.basename(sessionDir),
			...(agent ? { proxy: { ws: agent, mediaUpload: agent, mediaDownload: agent } } : {}),
			// Opsi disamakan dengan contoh resmi zapo (examples/example.ts)
			connectTimeoutMs: 15_000,
			deviceBrowser: 'Chrome',
			deviceOsDisplayName: 'Windows',
			history: { enabled: true, requireFullSync: true },
			nodeQueryTimeoutMs: 30_000,
		},
		createNoopLogger()
	);

	const ev = new EventEmitter();
	ev.setMaxListeners(50);

	// Peta LID <-> PN yang dipelajari dari key pesan (participantAlt dsb.)
	const lidToPn = new Map();
	const pnToLid = new Map();
	const learnPair = (a, b) => {
		if (!a || !b) return;
		if (String(a).endsWith('@lid') && !String(b).endsWith('@lid')) {
			lidToPn.set(jidNormalizedUser(a), jidNormalizedUser(b));
			pnToLid.set(jidNormalizedUser(b), jidNormalizedUser(a));
		} else if (String(b).endsWith('@lid') && !String(a).endsWith('@lid')) {
			lidToPn.set(jidNormalizedUser(b), jidNormalizedUser(a));
			pnToLid.set(jidNormalizedUser(a), jidNormalizedUser(b));
		}
	};

	let connectPromise = null;
	let isOpen = false;
	// "Soket siap pairing" = handshake selesai & soket bisa menjawab query.
	// Buktinya sinyal auth_qr / auth_pairing_required — BUKAN salah satunya
	// secara wajib: auth_pairing_required ternyata tidak selalu dipancarkan
	// (di panel bot-hosting tidak pernah datang walau QR terus berputar),
	// sedangkan WaPairingFlow zapo hanya butuh soket tersambung.
	let socketReady = false;
	const readyWaiters = new Set();
	const setSocketReady = v => {
		socketReady = v;
		if (v) for (const r of [...readyWaiters]) { readyWaiters.delete(r); r(); }
	};
	let qrLogged = false;

	const hisoka = {
		ev,
		user: null,
		logger: logger || null,
		_zapo: client,
		_botSentIds: new Set(),
		authState: {
			get creds() {
				const m = readMarker();
				return {
					registered: !!m || isOpen,
					me: m?.meJid ? { id: m.meJid, name: m.name } : undefined,
				};
			},
		},
		signalRepository: {
			lidMapping: {
				getPNForLID: async lid => {
					const hit = lidToPn.get(jidNormalizedUser(lid));
					if (hit) return hit;
					try {
						const pair = await client.privacy.resolveUserJidPair(lid);
						const pn = pair?.pnJid || pair?.phoneJid || null;
						if (pn) { learnPair(lid, pn); return jidNormalizedUser(pn); }
					} catch {}
					return null;
				},
				getLIDForPN: async pn => {
					const hit = pnToLid.get(jidNormalizedUser(pn));
					if (hit) return hit;
					try {
						const pair = await client.privacy.resolveUserJidPair(pn);
						const lid = pair?.lidJid || null;
						if (lid) { learnPair(pn, lid); return jidNormalizedUser(lid); }
					} catch {}
					return null;
				},
			},
		},
	};

	// ---------------- Konversi event zapo -> gaya Baileys ----------------

	function toWAMessage(e) {
		const key = { remoteJid: e.key.remoteJid, fromMe: !!e.key.fromMe, id: e.key.id };
		if (e.key.participant) key.participant = e.key.participant;
		if (e.key.remoteJidAlt) key.remoteJidAlt = e.key.remoteJidAlt;
		if (e.key.participantAlt) key.participantAlt = e.key.participantAlt;
		learnPair(e.key.remoteJid, e.key.remoteJidAlt);
		learnPair(e.key.participant, e.key.participantAlt);
		return {
			key,
			message: e.message,
			pushName: e.pushName,
			messageTimestamp: e.timestampSeconds ?? Math.floor(Date.now() / 1000),
		};
	}

	client.on('auth_qr', ({ qr }) => {
		if (!qrLogged) { qrLogged = true; console.log('[zapo] sinyal QR diterima dari server (soket tersambung).'); }
		setSocketReady(true);
		ev.emit('connection.update', { qr });
	});

	client.on('auth_pairing_required', () => {
		console.log('[zapo] sinyal pairing_required diterima dari server.');
		setSocketReady(true);
	});

	client.on('auth_paired', ({ credentials }) => {
		writeMarker({
			meJid: credentials?.meJid,
			meLid: credentials?.meLid,
			name: credentials?.meDisplayName,
			at: Date.now(),
		});
	});

	client.on('connection', connEv => {
		if (connEv.status !== 'open') {
			console.log(`[zapo] connection: ${connEv.status}${connEv.reason ? ` — ${connEv.reason}` : ''}`);
		}
		if (connEv.status === 'open') {
			isOpen = true;
			const m = readMarker();
			const meJid = m?.meJid || client.auth?.credentials?.meJid || '';
			hisoka.user = {
				id: jidNormalizedUser(meJid),
				name: m?.name || client.auth?.credentials?.meDisplayName || '',
				lid: m?.meLid,
			};
			if (meJid && !m) writeMarker({ meJid, name: hisoka.user.name, at: Date.now() });
			ev.emit('connection.update', { connection: 'open', isNewLogin: connEv.isNewLogin });
			// Isi cache grup (best effort, async)
			hisoka.groupFetchAllParticipating()
				.then(all => {
					const list = Object.values(all || {});
					if (list.length) ev.emit('groups.upsert', list);
				})
				.catch(() => {});
		} else if (connEv.status === 'close') {
			isOpen = false;
			setSocketReady(false); // soket putus = kesiapan pairing gugur
			qrLogged = false;
			const statusCode = connEv.isLogout ? 401 : /restart/i.test(String(connEv.reason || '')) ? 515 : 428;
			const error = new Error(String(connEv.reason || 'connection closed'));
			error.output = { statusCode };
			ev.emit('connection.update', {
				connection: 'close',
				lastDisconnect: { error, date: new Date() },
				isLogout: !!connEv.isLogout,
			});
		}
	});

	client.on('message', e => {
		if (!e?.key || !e?.message) return;
		ev.emit('messages.upsert', { messages: [toWAMessage(e)], type: 'notify' });
	});

	client.on('message_protocol', e => {
		if (!e?.key) return;
		const wam = toWAMessage(e);
		wam.message = { ...(e.message || {}), protocolMessage: e.protocolMessage };
		ev.emit('messages.upsert', { messages: [wam], type: 'notify' });
	});

	client.on('message_addon', e => {
		if (!e?.key) return;
		const base = {
			remoteJid: e.key.remoteJid,
			fromMe: !!e.key.fromMe,
			id: e.key.id,
		};
		if (e.key.participant) base.participant = e.key.participant;
		const targetKey = normKey({ remoteJid: e.key.remoteJid, id: e.targetMessageId, fromMe: false, participant: e.key.participant });
		let message = null;
		if (e.kind === 'reaction' && e.decrypted?.reaction) {
			message = {
				reactionMessage: {
					key: targetKey,
					text: e.decrypted.reaction.text || '',
					senderTimestampMs: Number(e.decrypted.reaction.senderTimestampMs) || Date.now(),
				},
			};
		} else if (e.kind === 'message_edit' && e.decrypted?.message) {
			message = {
				protocolMessage: {
					key: targetKey,
					type: 14, // MESSAGE_EDIT
					editedMessage: e.decrypted.message,
					timestampMs: Date.now(),
				},
			};
		}
		if (!message) return;
		ev.emit('messages.upsert', {
			messages: [{ key: base, message, messageTimestamp: Math.floor(Date.now() / 1000) }],
			type: 'notify',
		});
	});

	client.on('receipt', e => {
		const statusMap = { delivered: 3, read: 4, played: 5, inactive: 2 };
		const updates = (e.messageIds || []).map(id => ({
			key: {
				remoteJid: e.chatJid || e.recipientJid || '',
				id,
				...(e.participantJid ? { participant: e.participantJid } : {}),
			},
			update: { status: statusMap[e.status] ?? 3 },
		}));
		if (updates.length) ev.emit('messages.update', updates);
	});

	client.on('group', e => {
		const groupJid = e.groupJid || e.chatJid;
		if (!groupJid) return;
		if (['add', 'remove', 'promote', 'demote'].includes(e.action) && Array.isArray(e.participants)) {
			ev.emit('group-participants.update', {
				id: groupJid,
				author: e.authorJid,
				participants: e.participants.map(p => p.phoneJid || p.jid).filter(Boolean),
				action: e.action,
			});
		}
		const upd = { id: groupJid };
		if (e.subject) upd.subject = e.subject;
		if (e.description !== undefined) upd.desc = e.description;
		ev.emit('groups.update', [upd]);
		// Segarkan cache metadata grup
		hisoka.groupMetadata(groupJid).catch(() => {});
	});

	// ---------------- Koneksi ----------------

	hisoka.connect = () => {
		if (connectPromise && isOpen) return connectPromise;
		connectPromise = client.connect().catch(err => {
			console.error('[zapo] connect gagal:', err?.message || err);
			connectPromise = null;
			throw err;
		});
		// Jangan biarkan rejection tanpa handler membunuh proses;
		// pemanggil yang butuh tetap bisa await connect().
		connectPromise.catch(() => {});
		return connectPromise;
	};

	hisoka.end = async () => {
		try { await client.disconnect(); } catch {}
		connectPromise = null;
		isOpen = false;
	};

	hisoka.logout = async () => {
		try { await client.logout(); } catch {}
		try { fs.rmSync(markerFile, { force: true }); } catch {}
		connectPromise = null;
		isOpen = false;
	};

	hisoka.ws = { close: () => { hisoka.end().catch(() => {}); } };

	hisoka.requestPairingCode = async (phone, customCode) => {
		// zapo TIDAK mensyaratkan event auth_pairing_required untuk meminta
		// kode: WaPairingFlow langsung mengirim IQ companion-hello lewat
		// soket yang tersambung (requireConnected di WaAuthClient). Gerbang
		// yang benar cukup "soket siap" (handshake selesai — terbukti dari
		// sinyal auth_qr). Menunggu auth_pairing_required terbukti macet
		// total di panel: event itu tidak pernah datang walau soket sehat.
		const digits = String(phone).replace(/[^0-9]/g, '');
		const deadline = Date.now() + 90000;
		let lastErr = null;
		while (Date.now() < deadline) {
			if (!socketReady) {
				await Promise.race([
					new Promise(res => readyWaiters.add(res)),
					delay(15000),
				]);
				continue;
			}
			try {
				return await client.auth.requestPairingCode(digits, true, customCode);
			} catch (err) {
				lastErr = err;
				const msg = String(err?.message || err);
				if (/429|rate-overlimit/i.test(msg)) throw err;
				// Soket ternyata belum siap / terputus di tengah jalan:
				// gugurkan kesiapan dan tunggu sinyal segar berikutnya.
				if (/not connected|not open|socket|closed/i.test(msg)) setSocketReady(false);
				await delay(1500);
			}
		}
		throw lastErr || new Error('pairing timeout: soket WhatsApp tidak kunjung siap');
	};

	// ---------------- Kirim pesan ----------------

	function toQuoteRef(quoted) {
		if (!quoted) return undefined;
		const key = quoted.key || quoted;
		return {
			id: key.id,
			participant: key.participant,
			remoteJid: key.remoteJid,
			message: quoted.raw || quoted.message,
		};
	}

	function wrapResult(jid, res, payload) {
		const id = res?.id || '';
		if (id) {
			hisoka._botSentIds.add(id);
			setTimeout(() => hisoka._botSentIds.delete(id), 10 * 60 * 1000);
			if (hisoka._botSentIds.size > 1000) hisoka._botSentIds.delete(hisoka._botSentIds.values().next().value);
		}
		return {
			key: {
				id,
				remoteJid: jid,
				fromMe: true,
				...(isJidGroup(jid) && hisoka.user?.id ? { participant: hisoka.user.id } : {}),
			},
			message: typeof payload === 'object' ? payload : { conversation: String(payload ?? '') },
			messageTimestamp: Math.floor(Date.now() / 1000),
		};
	}

	hisoka.sendMessage = async (jid, content = {}, options = {}) => {
		// Hapus pesan (revoke)
		if (content.delete) {
			const res = await client.message.send(jid, { type: 'revoke', target: normKey(content.delete) });
			return wrapResult(jid, res, {});
		}
		// Reaksi
		if (content.react) {
			const res = await client.message.send(jid, {
				type: 'reaction',
				emoji: content.react.text || '',
				target: normKey(content.react.key || {}),
			});
			return wrapResult(jid, res, {});
		}

		const opts = {};
		if (options.quoted) opts.quote = toQuoteRef(options.quoted);
		const mentions = content.mentions || options.mentions;
		if (Array.isArray(mentions) && mentions.length) opts.mentions = mentions;
		if (options.ephemeralExpiration) opts.expirationSeconds = options.ephemeralExpiration;
		if (content.edit) {
			const key = typeof content.edit === 'object' ? content.edit : {};
			opts.edit = { id: key.id, participant: key.participant };
		}

		// Pesan bertombol interaktif (native flow): { text, footer?, title?, buttons: [...] }
		if (Array.isArray(content.buttons) && content.buttons.length) {
			const proto = buildInteractiveMessage({
				text: content.text ?? content.caption ?? '',
				footer: content.footer || '',
				title: content.title || content.header || '',
				buttons: content.buttons,
			});
			const res = await client.message.send(jid, proto, opts);
			return wrapResult(jid, res, proto);
		}

		let payload;
		if (typeof content === 'string') {
			payload = content;
		} else if (content.image !== undefined) {
			const media = await normalizeMedia(content.image);
			payload = { type: 'image', media, caption: content.caption, mimetype: content.mimetype || detectImageMime(media) || 'image/jpeg', fileName: content.fileName };
		} else if (content.video !== undefined) {
			payload = {
				type: content.ptv ? 'ptv' : 'video',
				media: await normalizeMedia(content.video),
				caption: content.caption,
				mimetype: content.mimetype || 'video/mp4',
				gifPlayback: content.gifPlayback,
				seconds: content.seconds,
			};
		} else if (content.audio !== undefined) {
			payload = { type: 'audio', media: await normalizeMedia(content.audio), mimetype: content.mimetype || 'audio/mpeg', ptt: content.ptt, seconds: content.seconds, waveform: content.waveform };
		} else if (content.sticker !== undefined) {
			payload = { type: 'sticker', media: await normalizeMedia(content.sticker), mimetype: content.mimetype || 'image/webp' };
		} else if (content.document !== undefined) {
			payload = { type: 'document', media: await normalizeMedia(content.document), caption: content.caption, mimetype: content.mimetype || 'application/octet-stream', fileName: content.fileName };
		} else if (content.text !== undefined) {
			payload = { type: 'text', text: String(content.text) };
			if (content.contextInfo) payload.contextInfo = content.contextInfo;
		} else {
			// Proto mentah (IMessage) diteruskan langsung — zapo menerimanya.
			payload = content;
		}

		// Status broadcast dengan daftar penerima -> jalur status khusus
		if (jid === 'status@broadcast' && Array.isArray(options.statusJidList) && options.statusJidList.length) {
			const res = await client.status.send({ content: payload, recipients: options.statusJidList, options: opts });
			return wrapResult(jid, res, payload);
		}

		const res = await client.message.send(jid, payload, opts);
		return wrapResult(jid, res, payload);
	};

	hisoka.relayMessage = async (jid, message, options = {}) => {
		const res = await client.message.send(jid, message, { ...(options.messageId ? { id: options.messageId } : {}) });
		return wrapResult(jid, res, message);
	};

	// ---------------- Grup ----------------

	hisoka.groupMetadata = async jid => {
		const md = mapGroupMetadata(await client.group.queryGroupMetadata(jid));
		try { hisoka.groups?.write?.(jid, md); } catch {}
		return md;
	};

	hisoka.groupFetchAllParticipating = async () => {
		const all = await client.group.queryAllGroups();
		const out = {};
		for (const md of all || []) {
			const mapped = mapGroupMetadata(md);
			out[mapped.id] = mapped;
			try { hisoka.groups?.write?.(mapped.id, mapped); } catch {}
		}
		return out;
	};

	// ---------------- Profil & privasi ----------------

	hisoka.updateProfileStatus = async text => client.profile.setStatus(String(text ?? ''));

	hisoka.fetchPrivacySettings = async () => {
		const raw = await client.privacy.getPrivacySettings();
		const out = {};
		for (const [k, v] of Object.entries(raw || {})) out[PRIVACY_KEY_MAP[k] || k] = v;
		return out;
	};

	hisoka.fetchDisappearingDuration = async jid => {
		const res = await client.profile.getDisappearingMode([jid]);
		return (res || []).map(r => ({
			disappearing_mode: {
				duration: r.duration,
				setAt: r.timestamp ? new Date(r.timestamp * 1000).toISOString() : undefined,
			},
		}));
	};

	hisoka.onWhatsApp = async jid => {
		const target = jidNormalizedUser(jid);
		try {
			const profiles = await client.profile.getProfiles([target]);
			if (profiles?.length) return profiles.map(p => ({ jid: target, exists: true, ...p }));
		} catch {}
		return [{ jid: target, exists: undefined }];
	};

	// ---------------- Receipt & presence ----------------

	hisoka.sendReceipts = async (keys, type = 'read') => {
		const byChat = new Map();
		for (const key of keys || []) {
			const jid = key.remoteJid;
			if (!jid || !key.id) continue;
			const ck = `${jid}|${key.participant || ''}`;
			if (!byChat.has(ck)) byChat.set(ck, { jid, participant: key.participant, ids: [] });
			byChat.get(ck).ids.push(key.id);
		}
		for (const { jid, participant, ids } of byChat.values()) {
			await client.message.sendReceipt(jid, ids, { type, ...(participant ? { participant } : {}) });
		}
	};

	hisoka.readMessages = async keys => hisoka.sendReceipts(keys, 'read');

	hisoka.sendPresenceUpdate = async (type, jid) => {
		if (type === 'available' || type === 'unavailable') return client.presence.send(type);
		if (jid) {
			try { return await client.presence.sendChatstate(jid, { type }); } catch { return undefined; }
		}
		return undefined;
	};

	hisoka.presenceSubscribe = async jid => {
		try { return await client.presence.subscribe(jid); } catch { return undefined; }
	};

	// zapo menyinkronkan app state secara internal — no-op kompatibilitas.
	hisoka.resyncAppState = async () => true;

	// zapo menangani permintaan upload ulang media secara internal.
	hisoka.updateMediaMessage = async msg => msg;

	// Mulai koneksi di latar belakang (seperti makeWASocket Baileys).
	hisoka.connect();

	return hisoka;
}

export default createBotClient;
