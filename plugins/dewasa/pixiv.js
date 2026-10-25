'use strict';
// Auto-generated dari message.js — command: pixiv (aliases: px)
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
	name: 'pixiv',
	aliases: ['px'],
	category: 'other',
	desc: '',
	async run(ctx) {
	const { hisoka, m, query, text, quoted, message, messagesType } = ctx;
					{
						const raw = (query || '').trim();
						if (!raw) {
							await m.reply('Kasih kata kuncinya. Contoh: .pixiv kucing');
							return;
						}

						// Kalau berupa link artwork langsung -> unduh semua halamannya
						const artMatch = raw.match(/pixiv\.net\/(?:en\/)?artworks\/(\d+)/i) || raw.match(/^(\d{6,})$/);

						let tmpDir = '';
						try {
							if (artMatch) {
								await m.reply('🎨 Mengunduh artwork...');
								const res = await downloadPixivArtwork(artMatch[1]);
								tmpDir = res.tmpDir;
								await sendAlbum(hisoka, m.from, res.files);
							} else {
								// .pixiv <kata kunci> [jumlah] -> cari & kirim N gambar
								let count = 5;
								let keyword = raw;
								const numMatch = raw.match(/\s+(\d{1,2})$/);
								if (numMatch) {
									count = Math.max(1, Math.min(10, parseInt(numMatch[1])));
									keyword = raw.slice(0, numMatch.index).trim();
								}
								if (!keyword) {
									await m.reply('Kasih kata kuncinya. Contoh: .pixiv kucing');
									return;
								}
								await m.reply(`🔎 Mencari *${keyword}* di Pixiv...`);
								const res = await searchPixiv(keyword, count);
								tmpDir = res.tmpDir;
								await m.reply(`🎨 Ketemu ${res.files.length} gambar, mengirim...`);
								await sendAlbum(hisoka, m.from, res.files);
							}
						} catch (err) {
							await m.reply('❌ ' + (err?.message || 'Gagal mengambil dari Pixiv.'));
						} finally {
							if (tmpDir) cleanupPixiv(tmpDir);
						}
					}
					return;
	},
};
