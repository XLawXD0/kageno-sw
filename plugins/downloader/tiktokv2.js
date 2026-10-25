'use strict';
// Command: tiktokv2 / tt2 — download TikTok via ScrLxrd REST API (alternatif).

import { apiGet, pickMediaUrl, pickMeta, downloadBuffer, getApiKey, debugKeys } from '../../helper/scrlxrd-api.js';

export default {
	name: 'tiktokv2',
	aliases: ['tt2'],
	category: 'other',
	desc: 'Download video TikTok via API (alternatif)',
	async run(ctx) {
		const { hisoka, m, query } = ctx;
		const match = String(query || '').match(/https?:\/\/[^\s]*tiktok\.com[^\s]*/i);
		if (!match) {
			await m.reply('Kirim link TikTok. Contoh: `.tiktokv2 https://vt.tiktok.com/xxx/`');
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
			if (!videoUrl) {
				await m.reply(`❌ Link download tidak ditemukan di respons API.\n${debugKeys(json)}`);
				return;
			}
			const buf = await downloadBuffer(videoUrl, 100);
			await hisoka.sendMessage(m.from, { video: buf, caption }, { quoted: m });
		} catch (e) {
			try { await load.fail('❌ ' + (e?.message || 'Gagal mengambil TikTok.')); }
			catch { await m.reply('❌ ' + (e?.message || 'Gagal mengambil TikTok.')); }
		}
	},
};
