'use strict';
// Command: play — download audio lagu via ScrLxrd REST API.

import { apiGet, pickMediaUrl, pickMeta, downloadBuffer, getApiKey, debugKeys } from '../../helper/scrlxrd-api.js';

export default {
	name: 'play',
	aliases: [],
	category: 'other',
	desc: 'Download audio lagu via API',
	async run(ctx) {
		const { hisoka, m, query } = ctx;
		const q = (query || '').trim();
		if (!q) {
			await m.reply('Kasih judul lagunya. Contoh: `.play dj malam pagi`');
			return;
		}
		if (!getApiKey()) {
			await m.reply('❌ SCRLXRD_API_KEY belum diset di .env');
			return;
		}
		const { startLoading } = await import('../../helper/loading.js');
		const load = await startLoading(hisoka, m, 'Mencari lagu');
		try {
			const json = await apiGet('/api/downloader/play', { query: q });
			const meta = pickMeta(json);
			const audioUrl = pickMediaUrl(json, 'audio');
			await load.stop();
			if (!audioUrl) {
				await m.reply(`❌ Link audio tidak ditemukan di respons API.\n${debugKeys(json)}`);
				return;
			}
			const buf = await downloadBuffer(audioUrl, 50);
			const safeTitle = (meta.title || q).replace(/[\\/:*?"<>|]/g, '').slice(0, 80) || 'audio';
			const content = buf.length > 100 * 1024 * 1024
				? { document: buf, fileName: `${safeTitle}.mp3`, mimetype: 'audio/mpeg' }
				: { audio: buf, mimetype: 'audio/mpeg', fileName: `${safeTitle}.mp3` };
			await hisoka.sendMessage(m.from, content, { quoted: m });
		} catch (e) {
			try { await load.fail('❌ ' + (e?.message || 'Gagal mengunduh audio.')); }
			catch { await m.reply('❌ ' + (e?.message || 'Gagal mengunduh audio.')); }
		}
	},
};
