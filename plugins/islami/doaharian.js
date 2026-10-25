'use strict';
// Auto-generated dari message.js — command: doaharian (aliases: doa)
// Kategori: ISLAMI & PRIMBON

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
	name: 'doaharian',
	aliases: ['doa'],
	category: 'ISLAMI & PRIMBON',
	desc: '',
	async run(ctx) {
	const { hisoka, m, query, text, quoted, message, messagesType } = ctx;
					{
						const { getDoaHarian, formatDoa, getDoaCount } = await import('../../helper/islami.js');
						try {
							const q = (query || '').trim();
							const total = getDoaCount();
							let idx = null;
							if (q && !isNaN(q)) {
								idx = Math.max(0, Math.min(total - 1, parseInt(q) - 1));
							}
							const { doa, index } = getDoaHarian(idx);
							await m.reply(formatDoa(doa, index, total) + `\n\n_Lihat doa lain: .doa <1-${total}>_`);
						} catch (err) {
							await m.reply('❌ ' + (err?.message || 'Gagal.'));
						}
					}
					return;
	},
};
