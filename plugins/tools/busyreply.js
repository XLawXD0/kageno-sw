'use strict';
// Auto-generated dari message.js — command: busyreply
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
	name: 'busyreply',
	aliases: [],
	category: 'other',
	desc: '',
	async run(ctx) {
	const { hisoka, m, query, text, quoted, message, messagesType } = ctx;
					{
						const v = (query || '').trim().toLowerCase();
						const cfg = loadBusyCfg(hisoka);
						if (v === 'stat') {
							const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date());
							const rows = Object.entries(cfg.counts)
								.filter(([, e]) => e.date === today)
								.map(([jid, e]) => `• ${jid.split('@')[0]}: ${e.count}x`);
							await m.reply(`📊 *BUSY-REPLY* (${cfg.enabled ? 'ON ✅' : 'OFF ❌'})\nHari ini:\n${rows.join('\n') || '(belum ada chat)'}`);
							return;
						}
						const val = ['on','1','nyala','ya'].includes(v) ? true : ['off','0','mati','tidak'].includes(v) ? false : null;
						if (val === null) {
							await m.reply('Pakai: .busyreply on / off / stat');
							return;
						}
						cfg.enabled = val;
						saveBusyCfg(cfg, hisoka);
						await m.reply(`Busy-reply sekarang *${val ? 'ON ✅' : 'OFF ❌'}*`);
					}
					return;
	},
};
