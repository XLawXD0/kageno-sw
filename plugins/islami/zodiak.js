'use strict';
// Auto-generated dari message.js — command: zodiak
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
	name: 'zodiak',
	aliases: [],
	category: 'ISLAMI & PRIMBON',
	desc: '',
	async run(ctx) {
	const { hisoka, m, query, text, quoted, message, messagesType } = ctx;
					{
						const { getZodiak, zodiakInfo } = await import('../../helper/primbon.js');
						const q = (query || '').trim();
						if (!q) { await m.reply('Contoh: `.zodiak 17 8` (tgl bln) atau `.zodiak leo`'); return; }
						try {
							const parts = q.split(/\s+/);
							if (parts.length >= 2 && !isNaN(parts[0])) {
								const z = getZodiak(parseInt(parts[0]), parseInt(parts[1]));
								const info = await zodiakInfo(z).catch(() => null);
								await m.reply(`⭐ *Zodiak:* ${z.toUpperCase()}\n${info ? `\n${info}` : ''}`);
							} else {
								const info = await zodiakInfo(parts[0].toLowerCase());
								await m.reply(`⭐ *Zodiak ${parts[0].toUpperCase()}*\n\n${typeof info === 'string' ? info : JSON.stringify(info)}`);
							}
						} catch (err) { await m.reply('❌ ' + (err?.message || 'Gagal.')); }
					}
					return;
	},
};
