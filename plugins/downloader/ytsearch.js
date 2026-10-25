'use strict';
// Auto-generated dari message.js — command: ytsearch (aliases: yts)
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
	name: 'ytsearch',
	aliases: ['yts'],
	category: 'other',
	desc: '',
	async run(ctx) {
	const { hisoka, m, query, text, quoted, message, messagesType } = ctx;
					{
						const q = (query || '').trim();
						if (!q) {
							await m.reply('Cari video YouTube. Contoh: `.ytsearch kucing lucu`');
							return;
						}
						await m.reply('🔍 Mencari di YouTube...');
						try {
							const { searchYoutube, fmtDur } = await import('../../helper/iyansearch.js');
							const vids = await searchYoutube(q, 5);
							const list = vids.map((v, i) => `${i + 1}. *${v.title}*\n   👤 ${v.uploader} | ⏱️ ${fmtDur(v.duration)}\n   🔗 ${v.url}`).join('\n\n');
							await m.reply(`🎬 *Hasil YouTube: "${q}"*\n\n${list}\n\n_Download: .play <judul>_`);
						} catch (err) {
							await m.reply('❌ ' + (err?.message || 'Gagal mencari.'));
						}
					}
					return;
	},
};
