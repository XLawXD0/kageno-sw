'use strict';
// Auto-generated dari message.js — command: ppcouple (aliases: ppc)
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
	name: 'ppcouple',
	aliases: ['ppc'],
	category: 'other',
	desc: '',
	async run(ctx) {
	const { hisoka, m, query, text, quoted, message, messagesType } = ctx;
					{
						const raw = (query || '').trim();
						const theme = raw || 'anime';
						await m.reply(`💑 Cari pp couple *${theme}*...`);
						try {
							const { searchPinterest, cleanupPinterest } = await import('../../helper/pinterest.js');
							const { execFile: execFileAsync } = await import('child_process');
							const { promisify } = await import('util');
							const execFileP = promisify(execFileAsync);
							// cari gambar couple yang lebar (cocok untuk di-split)
							const res = await searchPinterest(`pp couple ${theme}`, 5);
							if (!res.files.length) {
								await m.reply('❌ Tidak ketemu. Coba tema lain.');
								cleanupPinterest(res.tmpDir);
								return;
							}
							// ambil 1 gambar, split jadi 2 (kiri-kanan) biar pasangannya cocok
							const src = res.files[0];
							const left = src + '_left.jpg';
							const right = src + '_right.jpg';
							await execFileP('ffmpeg', ['-y', '-i', src, '-vf', 'crop=iw/2:ih:0:0', left], { timeout: 30000 });
							await execFileP('ffmpeg', ['-y', '-i', src, '-vf', 'crop=iw/2:ih:iw/2:0', right], { timeout: 30000 });
							await hisoka.sendMessage(
								m.from,
								{ image: fs.readFileSync(left), caption: `💑 PP Couple *${theme}*\n👦 Untuk cowok` },
								{ quoted: m }
							);
							await hisoka.sendMessage(
								m.from,
								{ image: fs.readFileSync(right), caption: `👧 Untuk cewek` }
							);
							await m.reply(`_Mau yang lain? Ketik \`.ppcouple ${theme}\` lagi_`);
							cleanupPinterest(res.tmpDir);
						} catch (err) {
							await m.reply('❌ ' + (err?.message || 'Gagal mencari pp couple.'));
						}
					}
					return;
	},
};
