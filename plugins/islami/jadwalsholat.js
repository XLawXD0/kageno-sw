'use strict';
// Auto-generated dari message.js — command: jadwalsholat (aliases: sholat)
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
	name: 'jadwalsholat',
	aliases: ['sholat'],
	category: 'ISLAMI & PRIMBON',
	desc: '',
	async run(ctx) {
	const { hisoka, m, query, text, quoted, message, messagesType } = ctx;
					{
						const { getJadwalSholat, formatJadwal } = await import('../../helper/islami.js');
						const kota = (query || '').trim() || 'Jakarta';
						await m.reply('🕌 Mengambil jadwal sholat...');
						try {
							const j = await getJadwalSholat(kota);
							await m.reply(formatJadwal(j));
						} catch (err) {
							await m.reply('❌ ' + (err?.message || 'Gagal.'));
						}
					}
					return;
	},
};
