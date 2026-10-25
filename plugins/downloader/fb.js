'use strict';
// Command: fb / facebook — download video Facebook via ScrLxrd REST API.

import { apiGet, pickMediaUrl, pickMeta, downloadBuffer, getApiKey, debugKeys } from '../../helper/scrlxrd-api.js';

export default {
	name: 'fb',
	aliases: ['facebook', 'fbdl'],
	category: 'downloader',
	desc: 'Download video Facebook via API\n\nContoh: `.fb https://www.facebook.com/...`',
	async run(ctx) {
		const { hisoka, m, query } = ctx;
		const match = String(query || '').match(/https?:\/\/[^\s]*(facebook\.com|fb\.watch)[^\s]*/i);
		if (!match) {
			await m.reply('Kirim link Facebook yang valid. Contoh: `.fb https://www.facebook.com/...`');
			return;
		}
		if (!getApiKey()) {
			await m.reply('❌ SCRLXRD_API_KEY belum diset di .env');
			return;
		}
		const { startLoading } = await import('../../helper/loading.js');
		const load = await startLoading(hisoka, m, 'Mengambil Facebook');
		try {
			const json = await apiGet('/api/downloader/facebook', { url: match[0] });
			const meta = pickMeta(json);
			const videoUrl = pickMediaUrl(json, 'video');
			const caption = `📘 *${meta.title || 'Facebook'}*${meta.author ? `\n👤 ${meta.author}` : ''}`;
			await load.stop();
			if (!videoUrl) {
				await m.reply(`❌ Link download tidak ditemukan di respons API.\n${debugKeys(json)}`);
				return;
			}
			const buf = await downloadBuffer(videoUrl, 100);
			await hisoka.sendMessage(m.from, { video: buf, caption }, { quoted: m });
		} catch (e) {
			try { await load.fail('❌ ' + (e?.message || 'Gagal mengambil Facebook.')); }
			catch { await m.reply('❌ ' + (e?.message || 'Gagal mengambil Facebook.')); }
		}
	},
};
