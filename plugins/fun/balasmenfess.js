'use strict';
// Auto-generated dari message.js — command: balasmenfess
// Kategori: other

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
	name: 'balasmenfess',
	aliases: [],
	category: 'other',
	desc: '',
	async run(ctx) {
	const { hisoka, m, query, text, quoted, message, messagesType } = ctx;
					{
						const { getMenfess, saveMenfess } = await import('../../helper/menfess.js');
						const menfess = getMenfess();
						const room = Object.values(menfess).find(s => (s.a === m.sender || s.b === m.sender) && s.state === 'WAITING');
						if (!room) { await m.reply('Tidak ada menfess menunggu.'); return; }
						room.state = 'CHATTING';
						// Pastikan b = yang menerima
						if (room.a !== m.sender && room.b !== m.sender) { await m.reply('Sesi tidak valid.'); return; }
						saveMenfess(menfess);
						const other = room.a === m.sender ? room.b : room.a;
						await hisoka.sendMessage(other, { text: '💌 Menfess diterima! Kalian sekarang bisa chat via `.menfess <pesan>`.' });
						await m.reply('Menfess diterima! Ketik `.menfess <pesan>` untuk chat.');
					}
					return;
	},
};
