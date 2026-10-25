'use strict';
// Auto-generated dari message.js — command: groups (aliases: group, listgroups, listgroup)
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
	name: 'groups',
	aliases: ['group', 'listgroups', 'listgroup'],
	category: 'other',
	desc: '',
	async run(ctx) {
	const { hisoka, m, query, text, quoted, message, messagesType } = ctx;
					{
						const groups = Object.values(await hisoka.groupFetchAllParticipating());
						groups.map(g => hisoka.groups.write(g.id, g));

						let text = `*Total ${groups.length} groups*\n`;
						text += `\n*Total Participants in all groups:* ${Array.from(groups).reduce(
							(a, b) => a + b.participants.length,
							0
						)}\n\n`;
						groups
							.filter(group => isJidGroup(group.id))
							.forEach((group, i) => {
								text += `${i + 1}. *${group.subject}* - ${group.participants.length} participants\n`;
							});

						await m.reply(text.trim());
					}
					return;
	},
};
