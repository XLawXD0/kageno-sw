'use strict';
// Command: bratvid2 — stiker video brat V2 dari teks via ScrLxrd REST API.
// Animasi kata muncul satu per satu. Maks 200 karakter.

import { apiMediaBuffer, getApiKey } from '../../helper/scrlxrd-api.js';
import { bufferToSticker } from '../../helper/sticker.js';

export default {
	name: 'bratvid2',
	aliases: [],
	category: 'sticker',
	desc: 'Bikin stiker video brat V2 dari teks (maks 200 karakter)\n\nContoh: `.bratvid2 halo dunia apa kabar`',
	async run(ctx) {
		const { hisoka, m, query } = ctx;
		const text = (query || '').trim();
		if (!text) {
			await m.reply('Kasih teksnya. Contoh: `.bratvid2 halo dunia`');
			return;
		}
		if (text.length > 200) {
			await m.reply('❌ Teks maksimal 200 karakter.');
			return;
		}
		if (!getApiKey()) {
			await m.reply('❌ SCRLXRD_API_KEY belum diset di settings.js');
			return;
		}
		const { startLoading } = await import('../../helper/loading.js');
		const load = await startLoading(hisoka, m, 'Membuat stiker video brat');
		try {
			const media = await apiMediaBuffer('/api/maker/bratvid2', { text, format: 'mp4' });
			const sticker = await bufferToSticker(media);
			await load.stop();
			await hisoka.sendMessage(m.from, { sticker }, { quoted: m });
		} catch (e) {
			try { await load.fail('❌ ' + (e?.message || 'Gagal membuat stiker video brat.')); }
			catch { await m.reply('❌ ' + (e?.message || 'Gagal membuat stiker video brat.')); }
		}
	},
};
