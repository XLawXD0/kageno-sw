'use strict';
// Auto-generated dari message.js — command: pin (aliases: pinterest)
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
	name: 'pin',
	aliases: ['pinterest'],
	category: 'other',
	desc: '',
	async run(ctx) {
	const { hisoka, m, query, text, quoted, message, messagesType } = ctx;
					{
						const raw = (query || '').trim();
						if (!raw) {
							await m.reply('Kasih kata kuncinya. Contoh: .pin kucing lucu');
							return;
						}

						// Kalau berupa link pin langsung -> unduh pin itu
						const pinUrl = raw.match(/https?:\/\/[^\s]*pinterest\.com\/pin\/[^\s]*/i);

						let tmpDir = '';
						try {
							if (pinUrl) {
								await m.reply('📌 Mengunduh pin...');
								const res = await downloadPinterestPin(pinUrl[0]);
								tmpDir = res.tmpDir;
								// Kirim SEMUA sekaligus (paralel) -> tiba berbarengan -> tampil sebagai album
								await sendAlbum(hisoka, m.from, res.files);
							} else {
								// .pin <kata kunci> [jumlah] -> cari & kirim N gambar
								let count = 5;
								let keyword = raw;
								const numMatch = raw.match(/\s+(\d{1,2})$/);
								if (numMatch) {
									count = Math.max(1, Math.min(10, parseInt(numMatch[1])));
									keyword = raw.slice(0, numMatch.index).trim();
								}
								if (!keyword) {
									await m.reply('Kasih kata kuncinya. Contoh: .pin kucing lucu');
									return;
								}
								await m.reply(`🔎 Mencari *${keyword}* di Pinterest...`);
								const res = await searchPinterest(keyword, count);
								tmpDir = res.tmpDir;
								await m.reply(`📌 Ketemu ${res.files.length} gambar, mengirim...`);
								// Kirim SEMUA sekaligus (paralel) -> tiba berbarengan -> tampil sebagai album
								await sendAlbum(hisoka, m.from, res.files);
							}
						} catch (err) {
							await m.reply('❌ ' + (err?.message || 'Gagal mengambil dari Pinterest.'));
						} finally {
							if (tmpDir) cleanupPinterest(tmpDir);
						}
					}
					return;
	},
};
