'use strict';
// Command: tt / tiktok / dl — download TikTok via ScrLxrd REST API.

import { apiGet, pickMediaUrl, pickMeta, downloadBuffer, getApiKey, debugKeys } from '../../helper/scrlxrd-api.js';

export default {
	name: 'tt',
	aliases: ['tiktok', 'dl'],
	category: 'other',
	desc: 'Download video TikTok (tanpa watermark) via API',
	async run(ctx) {
		const { hisoka, m, query } = ctx;
		const match = String(query || '').match(/https?:\/\/[^\s]*tiktok\.com[^\s]*/i);
		if (!match) {
			await m.reply('Kirim link TikTok yang valid. Contoh: `.tt https://vt.tiktok.com/xxx/`');
			return;
		}
		if (!getApiKey()) {
			await m.reply('❌ SCRLXRD_API_KEY belum diset di .env');
			return;
		}
		const { startLoading } = await import('../../helper/loading.js');
		const load = await startLoading(hisoka, m, 'Mengambil TikTok');
		try {
			const json = await apiGet('/api/downloader/tiktok', { url: match[0] });
			const meta = pickMeta(json);
			const videoUrl = pickMediaUrl(json, 'video');
			const caption = `🎵 *${meta.title || 'TikTok'}*${meta.author ? `\n👤 ${meta.author}` : ''}`;
			await load.stop();
			if (videoUrl) {
				const buf = await downloadBuffer(videoUrl, 100);
				const content = buf.length > 100 * 1024 * 1024
					? { document: buf, fileName: 'tiktok.mp4', mimetype: 'video/mp4', caption }
					: { video: buf, caption };
				await hisoka.sendMessage(m.from, content, { quoted: m });
				return;
			}
			// Fallback: mungkin slide foto
			const imgUrl = pickMediaUrl(json, 'image');
			if (imgUrl) {
				const buf = await downloadBuffer(imgUrl, 20);
				await hisoka.sendMessage(m.from, { image: buf, caption }, { quoted: m });
				return;
			}
			await m.reply(`❌ Link download tidak ditemukan di respons API.\n${debugKeys(json)}`);
		} catch (e) {
			try { await load.fail('❌ ' + (e?.message || 'Gagal mengambil TikTok.')); }
			catch { await m.reply('❌ ' + (e?.message || 'Gagal mengambil TikTok.')); }
		}
	},
};
