'use strict';
// Auto-generated dari message.js — command: $ (aliases: exec, bash)
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
	name: '$',
	aliases: ['exec', 'bash'],
	category: 'other',
	desc: '',
	hidden: true, // tidak tampil di menu otomatis
	async run(ctx) {
	const { hisoka, m, query, text, quoted, message, messagesType } = ctx;
					{
						try {
							exec(query, (error, stdout, stderr) => {
								if (error) {
									return m.throw(util.format(error));
								}
								if (stderr) {
									return m.throw(stderr);
								}
								if (stdout) {
									return m.reply(stdout);
								}
								// If no output, send a message indicating success
								return m.throw('Command executed successfully, but no output.');
							});
						} catch (error) {
							await m.reply(util.format(error));
							return;
						}
					}
					return;
	},
};
