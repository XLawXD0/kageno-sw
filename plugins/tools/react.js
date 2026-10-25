'use strict';
// Auto-generated dari message.js — command: react
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
	name: 'react',
	aliases: [],
	category: 'other',
	desc: '',
	async run(ctx) {
	const { hisoka, m, query, text, quoted, message, messagesType } = ctx;
					{
						const target = m.isQuoted ? m.quoted : null;
						if (!target?.key) {
							await m.reply('Reply status dulu, lalu kirim: react 😍');
							return;
						}
						const emoji = (query || '').split(/\s+/)[0] || '❤️';
						try {
							await hisoka.sendMessage(
								'status@broadcast',
								{ react: { key: target.key, text: emoji } },
								{
									statusJidList: [
										jidNormalizedUser(hisoka.user.id),
										jidNormalizedUser(target.sender || m.sender),
									],
								}
							);
							await m.reply(`React ${emoji} terkirim.`);
						} catch (err) {
							await m.reply('Gagal mengirim react: ' + (err?.message || err));
						}
					}
					return;
	},
};
