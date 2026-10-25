'use strict';
// Auto-generated dari message.js — command: khodam
// Kategori: FUN

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
	name: 'khodam',
	aliases: [],
	category: 'FUN',
	desc: '',
	async run(ctx) {
	const { hisoka, m, query, text, quoted, message, messagesType } = ctx;
					{
						const name = (query || '').trim() || m.pushName || 'Kamu';
						const khodams = [
							['Macan Putih', 'penjaga setia, galak kalau diganggu'],
							['Tuyul Botak', 'suka nyolong gorengan tetangga'],
							['Kuntilanak Merah', 'tertawanya bikin merinding'],
							['Pocong Loncat', 'lompatannya bisa 2 meter'],
							['Genderuwo', 'badannya bau menyan'],
							['Nyi Roro Kidul', 'ratu pantai selatan'],
							['Jenglot', 'kecil-kecil cabe rawit'],
							['Babi Ngepet', 'hobi begadang cari duit'],
							['Kuyang', 'kepalanya bisa terbang sendiri'],
							['Wewe Gombel', 'suka culik anak nakal'],
							['Sundel Bolong', 'punggungnya bolong, hati-hati'],
							['Banaspati', 'api terbang di malam hari'],
							['Leak', 'ilmu hitam level dewa'],
							['Kolor Ijo', 'legendanya para satpam'],
							['Suster Ngesot', 'jalannya ngesot tapi cepat'],
							['Khodam Kosong', 'tidak terdeteksi, coba lagi besok'],
							['Khodam Mantan', 'masih sering stalking kamu'],
							['Tuyul Tambun', 'perut buncit karena kebanyakan jajan'],
							['Pocong Gaul', 'pocong yang update tren'],
							['Setan Kredit', 'datang tiap tanggal tua nagih utang'],
						];
						const [khodam, desc] = khodams[Math.floor(Math.random() * khodams.length)];
						const power = Math.floor(Math.random() * 100) + 1;
						const bar = '█'.repeat(Math.round(power / 10)) + '░'.repeat(10 - Math.round(power / 10));
						await m.reply(
							`🔮 *CEK KHODAM*\n\n` +
								`👤 Nama: *${name}*\n` +
								`👻 Khodam: *${khodam}*\n` +
								`📜 Ciri: _${desc}_\n` +
								`⚡ Kekuatan: ${power}%\n${bar}`
						);
					}
					return;
	},
};
