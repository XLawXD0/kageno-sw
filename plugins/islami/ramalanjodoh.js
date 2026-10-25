'use strict';
// Auto-generated dari message.js — command: ramalanjodoh (aliases: jodoh)
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
	name: 'ramalanjodoh',
	aliases: ['jodoh'],
	category: 'ISLAMI & PRIMBON',
	desc: '',
	async run(ctx) {
	const { hisoka, m, query, text, quoted, message, messagesType } = ctx;
					{
						const { ramalanJodoh } = await import('../../helper/primbon.js');
						const parts = (query || '').split('|').map(s => s.trim());
						if (parts.length < 2) { await m.reply('Contoh: `.ramalanjodoh Budi|Siti`'); return; }
						await m.reply('💕 Menerawang jodoh...');
						try {
							const r = await ramalanJodoh(parts[0], parts[1]);
							await m.reply(`💕 *Ramalan Jodoh*\n\n• *${r.nama1}* & *${r.nama2}*\n• Kecocokan: ${r.kecocokan || r.persentase || '-'}\n${r.deskripsi ? `• ${r.deskripsi}` : ''}`);
						} catch (err) { await m.reply('❌ ' + (err?.message || 'Gagal.')); }
					}
					return;
	},
};
