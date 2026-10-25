'use strict';
// Auto-generated dari message.js — command: tpack (aliases: tsticker, tstiker, tgpack)
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
	name: 'tpack',
	aliases: ['tsticker', 'tstiker', 'tgpack'],
	category: 'STIKER',
	desc: '',
	async run(ctx) {
	const { hisoka, m, query, text, quoted, message, messagesType } = ctx;
					{
						const raw = (query || '').trim();
						if (!raw) {
							await m.reply('Kasih nama pack atau link-nya. Contoh:\n.tpack AnimeEmojis\n.tpack https://t.me/addstickers/AnimeEmojis');
							return;
						}
						let tmpDir = '';
						try {
							await m.reply('📦 Membuka pack Telegram...');
							const pack = await getTelegramPack(raw);
							await m.reply(`📦 *${pack.title}*\n🎨 Total ${pack.stickers.length} stiker, mengunduh...`);
							const res = await downloadTelegramPack(pack.stickers, 15);
							tmpDir = res.tmpDir;
							const skipNote = res.skipped ? ` (${res.skipped} animasi/video dilewati)` : '';
							await m.reply(`✅ Mengirim ${res.files.length} stiker${skipNote}...`);
							for (const f of res.files) {
								await hisoka.sendMessage(m.from, { sticker: fs.readFileSync(f) });
								await new Promise(r => setTimeout(r, 700));
							}
						} catch (err) {
							await m.reply('❌ ' + (err?.message || 'Gagal mengambil sticker pack Telegram.'));
						} finally {
							if (tmpDir) cleanupTelegramPack(tmpDir);
						}
					}
					return;
	},
};
