'use strict';
// Auto-generated dari message.js — command: cuaca
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
	name: 'cuaca',
	aliases: [],
	category: 'TOOLS',
	desc: '',
	async run(ctx) {
	const { hisoka, m, query, text, quoted, message, messagesType } = ctx;
					{
						const kota = (query || '').trim() || 'Jakarta';
						try {
							const r = await fetch(`https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(kota)},ID&units=metric&lang=id&appid=`, {
								signal: AbortSignal.timeout(15000),
							}).catch(() => null);
							// Fallback: wttr.in (gratis, tanpa key)
							const r2 = await fetch(`https://wttr.in/${encodeURIComponent(kota)}?format=j1`, {
								headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(15000),
							});
							if (!r2.ok) throw new Error('Gagal.');
							const j = await r2.json();
							const c = j.current_condition[0];
							await m.reply(`🌤️ *Cuaca ${kota}*\n\n🌡️ Suhu: ${c.temp_C}°C (terasa ${c.FeelsLikeC}°C)\n💧 Kelembapan: ${c.humidity}%\n💨 Angin: ${c.windspeedKmph} km/h\n👁️ Jarak pandang: ${c.visibility} km\n📝 ${c.weatherDesc[0].value}`);
						} catch { await m.reply('❌ Gagal ambil cuaca.'); }
					}
					return;
	},
};
