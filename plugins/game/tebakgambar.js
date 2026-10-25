'use strict';
// Auto-generated dari message.js — command: tebakgambar (aliases: tebakkata, tebakbendera, tebakbendera2, susunkata, tekateki, asahotak, caklontong, family100, siapakahaku, siapaaku, tebakkimia, tebaklirik, tebakkalimat)
// Kategori: GAME

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
	name: 'tebakgambar',
	aliases: ['tebakkata', 'tebakbendera', 'tebakbendera2', 'susunkata', 'tekateki', 'asahotak', 'caklontong', 'family100', 'siapakahaku', 'siapaaku', 'tebakkimia', 'tebaklirik', 'tebakkalimat'],
	category: 'GAME',
	desc: '',
	async run(ctx) {
	const { hisoka, m, query, text, quoted, message, messagesType } = ctx;
					{
						const { startGame, formatQuestion, hasSession } = await import('../../helper/games.js');
						const game = m.command;
						if (hasSession(m.from)) {
							await m.reply('Masih ada sesi game yang belum selesai!');
							return;
						}
						await m.reply('🎮 Mengambil soal...');
						try {
							const { soal, type } = await startGame(m.from, game, (s) => {
								hisoka.sendMessage(m.from, { text: `⏰ Waktu habis!\nJawaban: *${s.jawaban}*` }, { quoted: m }).catch(() => {});
							});
							const caption = formatQuestion(game, soal);
							if (type === 'image' && soal.img) {
								await hisoka.sendMessage(m.from, { image: { url: soal.img }, caption }, { quoted: m });
							} else {
								await m.reply(caption);
							}
						} catch (err) {
							await m.reply('❌ ' + (err?.message || 'Gagal mulai game.'));
						}
					}
					return;
	},
};
