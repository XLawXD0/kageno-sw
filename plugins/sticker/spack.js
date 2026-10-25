'use strict';
// Auto-generated dari message.js — command: spack (aliases: stickerpack, stikerpack)
// Kategori: STIKER

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
	name: 'spack',
	aliases: ['stickerpack', 'stikerpack'],
	category: 'STIKER',
	desc: '',
	async run(ctx) {
	const { hisoka, m, query, text, quoted, message, messagesType } = ctx;
					{
						const raw = (query || '').trim();
						if (!raw) {
							await m.reply('Kasih link pack sticker.ly-nya. Contoh:\n.spack https://sticker.ly/s/M3XUY1\natau kodenya aja: .spack M3XUY1');
							return;
						}
						let tmpDir = '';
						try {
							await m.reply('📦 Membuka pack stiker...');
							const pack = await getStickerPack(raw);
							await m.reply(`📦 *${pack.name}*\n🎨 Total ${pack.stickers.length} stiker, mengunduh...`);
							const res = await downloadStickerPack(pack.stickers, 15);
							tmpDir = res.tmpDir;
							await m.reply(`✅ Mengirim ${res.files.length} stiker...`);
							for (const f of res.files) {
								await hisoka.sendMessage(m.from, { sticker: fs.readFileSync(f) });
								await new Promise(r => setTimeout(r, 700));
							}
						} catch (err) {
							await m.reply('❌ ' + (err?.message || 'Gagal mengambil sticker pack.'));
						} finally {
							if (tmpDir) cleanupStickerPack(tmpDir);
						}
					}
					return;
	},
};
