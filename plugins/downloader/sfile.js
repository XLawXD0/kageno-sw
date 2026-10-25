'use strict';
// Auto-generated dari message.js — command: sfile
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
	name: 'sfile',
	aliases: [],
	category: 'other',
	desc: '',
	async run(ctx) {
	const { hisoka, m, query, text, quoted, message, messagesType } = ctx;
					{
						const q = (query || '').trim();
						if (!q) {
							await m.reply('Cari file di sfile. Contoh: `.sfile minecraft mod`');
							return;
						}
						await m.reply('🔍 Mencari di sfile...');
						try {
							const { searchSfile } = await import('../../helper/iyansearch.js');
							const files = await searchSfile(q);
							const list = files.slice(0, 10).map((f, i) => `${i + 1}. ${f.name}\n   🔗 ${f.url}`).join('\n\n');
							await m.reply(`📁 *Hasil sfile: "${q}"*\n\n${list}`);
						} catch (err) {
							await m.reply('❌ ' + (err?.message || 'Gagal mencari.'));
						}
					}
					return;
	},
};
