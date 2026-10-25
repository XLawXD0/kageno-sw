'use strict';
// Command: twitter / x / twtdl — download video Twitter/X via ScrLxrd REST API.

import { apiGet, pickMediaUrl, pickMeta, downloadBuffer, getApiKey, debugKeys } from '../../helper/scrlxrd-api.js';

export default {
	name: 'twitter',
	aliases: ['x', 'twtdl', 'twdl'],
	category: 'downloader',
	desc: 'Download video Twitter/X via API\n\nContoh: `.twitter https://x.com/...`',
	async run(ctx) {
		const { hisoka, m, query } = ctx;
		const match = String(query || '').match(/https?:\/\/[^\s]*(twitter\.com|x\.com)[^\s]*/i);
		if (!match) {
			await m.reply('Kirim link Twitter/X yang valid. Contoh: `.twitter https://x.com/...`');
			return;
		}
		if (!getApiKey()) {
			await m.reply('❌ SCRLXRD_API_KEY belum diset di .env');
			return;
		}
		const { startLoading } = await import('../../helper/loading.js');
		const load = await startLoading(hisoka, m, 'Mengambil Twitter/X');
		try {
			const json = await apiGet('/api/downloader/twitter', { url: match[0] });
			const meta = pickMeta(json);
			const videoUrl = pickMediaUrl(json, 'video');
			const caption = `🐦 *${meta.title || 'Twitter/X'}*${meta.author ? `\n👤 ${meta.author}` : ''}`;
			await load.stop();
			if (!videoUrl) {
				await m.reply(`❌ Link download tidak ditemukan di respons API.\n${debugKeys(json)}`);
				return;
			}
			const buf = await downloadBuffer(videoUrl, 100);
			await hisoka.sendMessage(m.from, { video: buf, caption }, { quoted: m });
		} catch (e) {
			try { await load.fail('❌ ' + (e?.message || 'Gagal mengambil Twitter/X.')); }
			catch { await m.reply('❌ ' + (e?.message || 'Gagal mengambil Twitter/X.')); }
		}
	},
};
