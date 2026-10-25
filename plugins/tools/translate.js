'use strict';
// Auto-generated dari message.js — command: translate (aliases: tr)
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
	name: 'translate',
	aliases: ['tr'],
	category: 'TOOLS',
	desc: '',
	async run(ctx) {
	const { hisoka, m, query, text, quoted, message, messagesType } = ctx;
					{
						const parts = (query || '').trim().split(/\s+/);
						if (parts.length < 2) { await m.reply('Contoh: `.translate en halo apa kabar`\n(kode bahasa: en, id, ja, ko, ar, dll)'); return; }
						const target = parts[0].toLowerCase();
						const text = parts.slice(1).join(' ');
						try {
							const r = await fetch(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${target}&dt=t&q=${encodeURIComponent(text)}`, {
								headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(15000),
							});
							const j = await r.json();
							const translated = j[0]?.map(x => x[0]).join('') || '-';
							const detected = j[2] || 'auto';
							await m.reply(`🌐 *Translate*\n\nDari (${detected}) → ${target}\n\n${translated}`);
						} catch { await m.reply('❌ Gagal translate.'); }
					}
					return;
	},
};
