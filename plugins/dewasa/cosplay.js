'use strict';
// Auto-generated dari message.js — command: cosplay
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
	name: 'cosplay',
	aliases: [],
	category: 'other',
	desc: '',
	async run(ctx) {
	const { hisoka, m, query, text, quoted, message, messagesType } = ctx;
					{
						const raw = (query || '').trim();
						if (!raw) {
							await m.reply(
								'╭─「 👘 *COSPLAYTELE SEARCH* 」\n' +
								'│\n' +
								'│ Cari foto cosplay dari\n' +
								'│ _cosplaytele.com_ secara realtime.\n' +
								'│\n' +
								'│ *Format:*\n' +
								'│ • `.cosplay <keyword>`\n' +
								'│ • `.cosplay random`\n' +
								'│\n' +
								'│ *Contoh:*\n' +
								'│ 1. `.cosplay mitsuri`\n' +
								'│ 2. `.cosplay rem re:zero`\n' +
								'│ 3. `.cosplay velma`\n' +
								'│ 4. `.cosplay random`\n' +
								'│\n' +
								'│ > ℹ️ Hasil dikirim sebagai *album foto.*\n' +
								'╰──────────────────────'
							);
							return;
						}
						await m.reply('🔍 Cari cosplay...');
						try {
							const { searchCosplay, getPostPhotos, getLatestPosts, downloadPhotos } = await import('../../helper/cosplay.js');
							let post;
							if (/^random$/i.test(raw)) {
								const latest = await getLatestPosts(20);
								if (!latest.length) { await m.reply('❌ Gagal ambil daftar postingan.'); return; }
								post = latest[Math.floor(Math.random() * latest.length)];
							} else {
								const results = await searchCosplay(raw, 5);
								if (!results.length) { await m.reply(`❌ Tidak ketemu hasil untuk "${raw}". Coba keyword lain.`); return; }
								post = results[0];
							}
							const photoUrls = await getPostPhotos(post.url, 8);
							if (!photoUrls.length) { await m.reply('❌ Tidak ada foto di postingan ini.'); return; }
							const tmpDir = `/tmp/cosplay_${Date.now()}`;
							const files = await downloadPhotos(photoUrls, tmpDir);
							if (!files.length) { await m.reply('❌ Gagal download foto.'); return; }
							const caption = `👘 *${post.title}*\n🔗 ${post.url}\n📸 ${files.length} foto`;
							await sendAlbum(hisoka, m.from, files);
							await m.reply(caption);
							try { (await import('fs')).rmSync(tmpDir, { recursive: true, force: true }); } catch {}
						} catch (err) {
							console.error('\x1b[31m[cosplay] error:\x1b[39m', err?.message || err);
							await m.reply('❌ Gagal ambil cosplay. Coba lagi nanti.');
						}
					}
					return;
	},
};
