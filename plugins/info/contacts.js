'use strict';
// Auto-generated dari message.js — command: contacts (aliases: contact, listcontacts, listcontact)
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
	name: 'contacts',
	aliases: ['contact', 'listcontacts', 'listcontact'],
	category: 'other',
	desc: '',
	async run(ctx) {
	const { hisoka, m, query, text, quoted, message, messagesType } = ctx;
					{
						const contacts = Array.from(hisoka.contacts.values()).filter(c => c.id);
						let text = '*Total:*\n\n';
						text += `- All Contacts: ${contacts.length}\n`;
						text += `- Saved Contacts: ${contacts.filter(v => v.isContact).length}\n`;
						text += `- Not Saved Contacts: ${contacts.filter(v => !v.isContact).length}\n`;
						await m.reply(text.trim());
					}
					return;
	},
};
