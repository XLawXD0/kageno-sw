'use strict';
// Auto-generated dari message.js — command: alay
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
	name: 'alay',
	aliases: [],
	category: 'FUN',
	desc: '',
	async run(ctx) {
	const { hisoka, m, query, text, quoted, message, messagesType } = ctx;
					{
						const text = (query || '').trim();
						if (!text) {
							await m.reply('Kasih teksnya. Contoh: .alay halo guys apa kabar');
							return;
						}
						let out = '';
						for (const ch of text) {
							out += /[a-zA-Z]/.test(ch) ? (Math.random() < 0.5 ? ch.toUpperCase() : ch.toLowerCase()) : ch;
						}
						await m.reply(out || text);
					}
					return;
	},
};
