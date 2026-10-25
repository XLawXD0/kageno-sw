'use strict';

// ============================================================
// compat.js — Lapisan kompatibilitas API gaya Baileys di atas zapo-js-mod.
//
// Seluruh kode bot (helper/handler/plugins) ditulis untuk API Baileys.
// File ini menyediakan fungsi-fungsi dengan nama & perilaku yang sama
// supaya kode lama tetap jalan, sementara library WhatsApp yang
// benar-benar dipakai adalah zapo-js-mod.
// ============================================================

import { HttpsProxyAgent } from 'https-proxy-agent';
import {
	proto,
	getContentType,
	unwrapMessage,
	downloadMediaMessage as zapoDownloadMediaMessage,
} from 'zapo-js-mod';

export { proto, getContentType };

// Baileys: extractMessageContent() membuka wrapper ephemeral/viewOnce/dll.
// zapo: unwrapMessage() melakukan hal yang sama.
export const extractMessageContent = unwrapMessage;

// ---------------- Util JID (semantik Baileys) ----------------

export function jidDecode(jid) {
	if (!jid) return undefined;
	const [userServer, device] = String(jid).split(':');
	const at = userServer.lastIndexOf('@');
	if (at < 0) return { user: userServer, server: '', device: device ? Number(device) : undefined };
	return {
		user: userServer.slice(0, at),
		server: userServer.slice(at + 1),
		device: device ? Number(device) : undefined,
	};
}

/** Hilangkan suffix device & petakan c.us -> s.whatsapp.net (seperti Baileys). */
export function jidNormalizedUser(jid) {
	if (!jid) return jid;
	const decoded = jidDecode(String(jid).replace(/:\d+(?=@)/, ''));
	if (!decoded) return jid;
	const server = decoded.server === 'c.us' ? 's.whatsapp.net' : decoded.server;
	return `${decoded.user}@${server}`;
}

export function jidNormalizedGroup(jid) {
	return jid ? String(jid).split(':')[0] : jid;
}

export function areJidsSameUser(a, b) {
	if (!a || !b) return false;
	return jidNormalizedUser(a) === jidNormalizedUser(b);
}

export const isJidGroup = jid => typeof jid === 'string' && jid.endsWith('@g.us');
export const isJidBroadcast = jid => typeof jid === 'string' && jid.endsWith('@broadcast');
export const isJidStatusBroadcast = jid => jid === 'status@broadcast';
export const isJidNewsletter = jid => typeof jid === 'string' && jid.endsWith('@newsletter');
export const isPnUser = jid => typeof jid === 'string' && jid.endsWith('@s.whatsapp.net');
export const isLidUser = jid => typeof jid === 'string' && jid.endsWith('@lid');

/** Baileys toNumber(): konversi Long protobuf / bigint / string ke number. */
export function toNumber(x) {
	if (typeof x === 'number') return x;
	if (typeof x === 'bigint') return Number(x);
	if (typeof x === 'string') return Number(x);
	if (x && typeof x === 'object') {
		if (typeof x.toNumber === 'function') return x.toNumber();
		if ('low' in x && 'high' in x) return x.high * 0x100000000 + (x.low >>> 0);
	}
	return Number(x) || 0;
}

/** ID pesan gaya Baileys: awalan 3EB0 + hex acak kapital. */
export function generateMessageIDV2(jid = '') {
	const hex = () => Math.floor(Math.random() * 0xffff).toString(16).toUpperCase().padStart(4, '0');
	return `3EB0${hex()}${hex()}${hex()}${hex()}`;
}
export const generateMessageID = generateMessageIDV2;

/**
 * Bentuk ulang generateWAMessageFromContent() Baileys:
 * menghasilkan objek mirip WAMessage dari proto IMessage.
 */
export function generateWAMessageFromContent(jid, message, options = {}) {
	const id = options.messageId || options.id || generateMessageIDV2(jid);
	const key = {
		id,
		remoteJid: jid,
		fromMe: true,
	};
	if (options.quoted?.key?.participant) key.participant = options.quoted.key.participant;
	return {
		key,
		message,
		messageTimestamp: Math.floor(Date.now() / 1000),
		status: 1,
	};
}

/** generateWAMessage() versi minimal (dipakai beberapa helper lama). */
export async function generateWAMessage(jid, content, options = {}) {
	return generateWAMessageFromContent(jid, content, options);
}

// ---------------- Unduh media ----------------

function proxyAgent() {
	const url = process.env.https_proxy || process.env.HTTPS_PROXY || '';
	return url ? new HttpsProxyAgent(url) : undefined;
}

async function streamToBuffer(stream) {
	if (Buffer.isBuffer(stream)) return stream;
	if (stream instanceof Uint8Array) return Buffer.from(stream);
	const chunks = [];
	for await (const chunk of stream) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
	return Buffer.concat(chunks);
}

/**
 * downloadContentFromMessage(content, type) versi Baileys:
 * mengembalikan stream (async iterable) isi media yang sudah didekripsi.
 */
export async function downloadContentFromMessage(content, type) {
	const message = { [`${type}Message`]: content };
	const stream = await zapoDownloadMediaMessage(message, { proxy: proxyAgent() });
	return stream;
}

/**
 * downloadMediaMessage(message, type, options, ctx) versi Baileys.
 * - type 'buffer'  -> Buffer
 * - type 'stream'  -> Readable stream
 */
export async function downloadMediaMessage(message, type = 'buffer', options = {}, ctx = {}) {
	const protoMsg = message?.message || message;
	let stream;
	try {
		// Coba bentuk event (punya key + message) — memberi zapo konteks key utk retry.
		stream = await zapoDownloadMediaMessage(
			message?.key ? { key: message.key, message: protoMsg } : protoMsg,
			{ proxy: proxyAgent() }
		);
	} catch (e) {
		stream = await zapoDownloadMediaMessage(protoMsg, { proxy: proxyAgent() });
	}
	if (type === 'stream') return stream;
	return streamToBuffer(stream);
}

export { streamToBuffer };
