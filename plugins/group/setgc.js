'use strict';
// Auto-generated dari message.js — command: setgc
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
	name: 'setgc',
	aliases: [],
	category: 'other',
	desc: '',
	async run(ctx) {
	const { hisoka, m, query, text, quoted, message, messagesType } = ctx;
					{
						const link = (query || '').trim();
						if (!link) {
							const cur = readGcLink();
							await m.reply(
								cur
									? `👥 Link grup saat ini:\n${cur}\n\nGanti dengan: .setgc <link>\nHapus dengan: .setgc hapus`
									: 'Kirim link invite grupnya. Contoh: .setgc https://chat.whatsapp.com/xxxx'
							);
							return;
						}
						if (/^hapus$/i.test(link)) {
							try { fs.unlinkSync(GC_JSON); } catch { /* abaikan */ }
							await m.reply('🗑️ Link grup dihapus dari menu.');
							return;
						}
						if (!/chat\.whatsapp\.com\//i.test(link)) {
							await m.reply('Link-nya harus invite grup WhatsApp (chat.whatsapp.com/...).');
							return;
						}
						fs.writeFileSync(GC_JSON, JSON.stringify({ invite: link }, null, 2));
						await m.reply(`✅ Link grup tersimpan! Sekarang muncul di menu:\n${link}`);
					}
					return;
	},
};
