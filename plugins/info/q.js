'use strict';
// Auto-generated dari message.js — command: q (aliases: quoted)
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
	name: 'q',
	aliases: ['quoted'],
	category: 'other',
	desc: '',
	async run(ctx) {
	const { hisoka, m, query, text, quoted, message, messagesType } = ctx;
					{
						// check if the message is a reply
						if (!m.isQuoted) {
							await m.reply('No quoted message found.');
							return;
						}

						// check if quoted message have quoted to
						const message = hisoka.cacheMsg.get(m.quoted.key.id);
						if (!message) {
							await m.reply('Quoted message not found.');
							return;
						}

						const IMessage = await injectMessage(hisoka, message);
						if (!IMessage.isQuoted) {
							await m.reply('Quoted message not found.');
							return;
						}

						await m.reply({ forward: IMessage.quoted });
					}
					return;
	},
};
