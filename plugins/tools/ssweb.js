'use strict';
// Auto-generated dari message.js — command: ssweb (aliases: ss)
// Kategori: TOOLS

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
	name: 'ssweb',
	aliases: ['ss'],
	category: 'TOOLS',
	desc: '',
	async run(ctx) {
	const { hisoka, m, query, text, quoted, message, messagesType } = ctx;
					{
						const url = (query || '').trim();
						if (!url) { await m.reply('Contoh: `.ssweb https://google.com`'); return; }
						const full = url.startsWith('http') ? url : 'https://' + url;
						await m.reply('📸 Mengambil screenshot...');
						try {
							const ssUrl = `https://image.thum.io/get/width/800/crop/600/${encodeURIComponent(full)}`;
							await hisoka.sendMessage(m.from, { image: { url: ssUrl }, caption: `📸 ${full}` }, { quoted: m });
						} catch { await m.reply('❌ Gagal screenshot.'); }
					}
					return;
	},
};
