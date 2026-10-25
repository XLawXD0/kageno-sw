'use strict';
// Auto-generated dari message.js — command: artinama
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
	name: 'artinama',
	aliases: [],
	category: 'ISLAMI & PRIMBON',
	desc: '',
	async run(ctx) {
	const { hisoka, m, query, text, quoted, message, messagesType } = ctx;
					{
						const { artiNama } = await import('../../helper/primbon.js');
						const nama = (query || '').trim();
						if (!nama) { await m.reply('Contoh: `.artinama Budi Santoso`'); return; }
						await m.reply('🔮 Menerawang nama...');
						try {
							const r = await artiNama(nama);
							await m.reply(`• *Nama:* ${r.nama}\n• *Arti:* ${r.arti}\n• *Catatan:* ${r.catatan}`);
						} catch (err) { await m.reply('❌ ' + (err?.message || 'Gagal.')); }
					}
					return;
	},
};
