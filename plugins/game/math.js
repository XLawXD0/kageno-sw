'use strict';
// Auto-generated dari message.js — command: math (aliases: kuismath)
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
	name: 'math',
	aliases: ['kuismath'],
	category: 'GAME',
	desc: '',
	async run(ctx) {
	const { hisoka, m, query, text, quoted, message, messagesType } = ctx;
					{
						const modes = {
							noob: [-10, 10, '+-', 15],
							easy: [-20, 20, '*/+-', 20],
							medium: [-50, 50, '*/+-', 40],
							hard: [-100, 100, '*/+-', 60],
						};
						const mode = (query || '').trim().toLowerCase() || 'easy';
						if (!modes[mode]) {
							await m.reply('Pilih mode: noob, easy, medium, hard\nContoh: `.math medium`');
							return;
						}
						const [min, max, ops, detik] = modes[mode];
						const a = Math.floor(Math.random() * (max - min + 1)) + min;
						const b = Math.floor(Math.random() * (max - min + 1)) + min;
						const op = ops[Math.floor(Math.random() * ops.length)];
						let jawaban = op === '+' ? a + b : op === '-' ? a - b : op === '*' ? a * b : Math.floor(a / b);
						const { getSession } = await import('../../helper/games.js');
						if (getSession(m.from)) { await m.reply('Masih ada sesi game!'); return; }
						// Daftarkan sesi custom
						const gm = await import('../../helper/games.js');
						gm._registerMath(m.from, String(jawaban), detik * 1000, (jwb) => {
							hisoka.sendMessage(m.from, { text: `⏰ Waktu habis!\nJawaban: *${jwb}*` }, { quoted: m }).catch(() => {});
						});
						await m.reply(`🔢 *MATH (${mode})*\n\nBerapa ${a} ${op} ${b} ?\n\n⏱️ ${detik} detik | Ketik jawaban langsung`);
					}
					return;
	},
};
