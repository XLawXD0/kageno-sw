'use strict';
// Auto-generated dari message.js — command: tolakmenfess (aliases: stopmenfess)
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
	name: 'tolakmenfess',
	aliases: ['stopmenfess'],
	category: 'other',
	desc: '',
	async run(ctx) {
	const { hisoka, m, query, text, quoted, message, messagesType } = ctx;
					{
						const { getMenfess, saveMenfess, findMenfessSession } = await import('../../helper/menfess.js');
						const menfess = getMenfess();
						const sess = findMenfessSession(menfess, m.sender);
						if (!sess) { await m.reply('Tidak ada sesi menfess.'); return; }
						const other = sess.a === m.sender ? sess.b : sess.a;
						delete menfess[sess.id];
						saveMenfess(menfess);
						try { await hisoka.sendMessage(other, { text: '💔 Sesi menfess diakhiri.' }); } catch {}
						await m.reply('Sesi menfess diakhiri.');
					}
					return;
	},
};
