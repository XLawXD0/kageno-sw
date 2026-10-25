'use strict';
// Auto-generated dari message.js — command: menfess (aliases: confess)
// Kategori: FUN

import * as shared from '../_shared.js';

	const {
		isJidGroup, jidNormalizedUser, jidDecode, generateWAMessageFromContent,
		exec, execFile, fileURLToPath, util, fs, path, os,
		glitch, msToTime,
		downloadTikTok, cleanupTikTok,
		downloadYouTubeAudio, cleanupYouTubeAudio,
		searchPinterest, downloadPinterestPin, cleanupPinterest,
		searchPixiv, downloadPixivArtwork, cleanupPixiv,
		getStickerPack, downloadStickerPack, cleanupStickerPack,
		getTelegramPack, downloadTelegramPack, cleanupTelegramPack,
		readSwConfig, writeSwConfig, extractEmojis,
		loadStoryCfg, saveStoryCfg, downloadTikTokHD, postToStatus,
		handleBusyReply, loadBusyCfg, saveBusyCfg,
		telegram, execFileAsync,
		PROJECT_ROOT, MENU_BANNER, GC_JSON,
		manhwaSearchCache, manhwaChapterCache,
		readGcLink, handleTikTokDownload, sendAlbum, handleSticker,
	} = shared;

export default {
	name: 'menfess',
	aliases: ['confess'],
	category: 'FUN',
	desc: '',
	async run(ctx) {
	const { hisoka, m, query, text, quoted, message, messagesType } = ctx;
					{
						const { getMenfess, saveMenfess, findMenfessSession } = await import('../../helper/menfess.js');
						const menfess = getMenfess();
						const senderJid = m.sender;
						// Kalau lagi dalam sesi chatting, teruskan pesan
						const active = Object.values(menfess).find(s => s.state === 'CHATTING' && (s.a === senderJid || s.b === senderJid));
						if (active) {
							const target = active.a === senderJid ? active.b : active.a;
							const senderNum = senderJid.split('@')[0];
							await hisoka.sendMessage(target, { text: `📩 Pesan menfess:\n\n${query || m.text}`, mentions: [senderJid] });
							await m.reply('Pesan diteruskan.');
							return;
						}
						const existing = findMenfessSession(menfess, senderJid);
						if (existing) {
							await m.reply('Kamu masih dalam sesi menfess. Ketik `.stopmenfess` untuk keluar.');
							return;
						}
						const parts = (query || '').split('|').map(s => s.trim());
						if (parts.length < 3) {
							await m.reply('Format: `.menfess nama|nomor|pesan`\nContoh: `.menfess Anonim|62812xxxx|Halo, aku suka kamu`');
							return;
						}
						let [nama, nomor, ...pesanParts] = parts;
						const pesan = pesanParts.join('|');
						nomor = nomor.replace(/^0/, '62').replace(/[^0-9]/g, '');
						if (!nomor || nomor.length < 9) {
							await m.reply('Nomor tidak valid.');
							return;
						}
						const targetJid = `${nomor}@s.whatsapp.net`;
						const id = senderJid;
						menfess[id] = { id, a: senderJid, b: targetJid, state: 'WAITING', nama };
						saveMenfess(menfess);
						await hisoka.sendMessage(targetJid, {
							text: `💌 *Ada menfess buat kamu!*\n\nDari: ${nama}\nPesan: ${pesan}\n\nKetik:\n.balasmenfess — terima & balas\n.tolakmenfess — tolak`
						});
						await m.reply('Menfess terkirim! Semoga dibalas ya 💌');
					}
					return;
	},
};
