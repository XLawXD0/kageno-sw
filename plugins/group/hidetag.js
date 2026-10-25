'use strict';
// Auto-generated dari message.js — command: hidetag (aliases: ht, everyone, all)
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
	name: 'hidetag',
	aliases: ['ht', 'everyone', 'all'],
	category: 'other',
	desc: '',
	async run(ctx) {
	const { hisoka, m, query, text, quoted, message, messagesType } = ctx;
					{
						if (!m.isGroup) {
							await m.reply('Command ini hanya bisa dipakai di dalam grup.');
							return;
						}

						const group = hisoka.groups.read(m.from);
						const participants = group.participants.map(v => v.phoneNumber || v.id);

						const msg = await hisoka.messageModify(m.from, /text|conversation/i.test(m.type) && query ? m : quoted, {
							quoted: undefined,
							text: `@${m.from}\n\n${query}`.trim(),
							mentions: participants.map(v => ({ id: v })).concat({ id: m.from, name: 'everyone' }),
						});

						await hisoka.relayMessage(m.from, msg.message);
					}
					return;
	},
};
