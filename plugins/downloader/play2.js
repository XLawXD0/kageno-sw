'use strict';
// Command: play2 / spotify / playsp — download lagu Spotify via ScrLxrd REST API.

import { apiGet, pickMediaUrl, pickMeta, downloadBuffer, getApiKey, debugKeys } from '../../helper/scrlxrd-api.js';

export default {
	name: 'play2',
	aliases: ['spotify', 'playsp'],
	category: 'downloader',
	desc: '🎵 Download lagu dari Spotify via API\n\nContoh:\n• `.play2 Lathi`\n• `.play2 https://open.spotify.com/track/xxx`',
	async run(ctx) {
		const { hisoka, m, query } = ctx;
		const q = (query || '').trim();
		if (!q) {
			await m.reply('Kasih judul lagu atau link Spotify. Contoh: `.play2 Lathi`');
			return;
		}
		if (!getApiKey()) {
			await m.reply('❌ SCRLXRD_API_KEY belum diset di .env');
			return;
		}
		const { startLoading } = await import('../../helper/loading.js');
		const load = await startLoading(hisoka, m, 'Mencari lagu Spotify');
		try {
			// spotifyplay menerima judul ATAU link spotify
			const json = await apiGet('/api/downloader/spotifyplay', { text: q });
			const meta = pickMeta(json);
			const audioUrl = pickMediaUrl(json, 'audio');
			await load.stop();
			if (!audioUrl) {
				await m.reply(`❌ Link audio tidak ditemukan di respons API.\n${debugKeys(json)}`);
				return;
			}
			const buf = await downloadBuffer(audioUrl, 50);
			const safeTitle = (meta.title || q).replace(/[\\/:*?"<>|]/g, '').slice(0, 80) || 'audio';
			await hisoka.sendMessage(m.from, {
				audio: buf,
				mimetype: 'audio/mpeg',
				fileName: `${safeTitle}.mp3`,
			}, { quoted: m });
		} catch (e) {
			try { await load.fail('❌ ' + (e?.message || 'Gagal mengunduh audio.')); }
			catch { await m.reply('❌ ' + (e?.message || 'Gagal mengunduh audio.')); }
		}
	},
};
