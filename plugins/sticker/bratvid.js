'use strict';
// Command: bratvid — stiker animasi (GIF) brat dari teks via ScrLxrd REST API.

import { apiMediaBuffer, getApiKey } from '../../helper/scrlxrd-api.js';
import { bufferToSticker } from '../../helper/sticker.js';

export default {
	name: 'bratvid',
	aliases: [],
	category: 'sticker',
	desc: 'Bikin stiker animasi brat dari teks\n\nContoh: `.bratvid halo dunia`',
	async run(ctx) {
		const { hisoka, m, query } = ctx;
		const text = (query || '').trim();
		if (!text) {
			await m.reply('Kasih teksnya. Contoh: `.bratvid halo dunia`');
			return;
		}
		if (!getApiKey()) {
			await m.reply('❌ SCRLXRD_API_KEY belum diset di settings.js');
			return;
		}
		const { startLoading } = await import('../../helper/loading.js');
		const load = await startLoading(hisoka, m, 'Membuat stiker animasi brat');
		try {
			const media = await apiMediaBuffer('/api/maker/bratvid', { text });
			const sticker = await bufferToSticker(media);
			await load.stop();
			await hisoka.sendMessage(m.from, { sticker }, { quoted: m });
		} catch (e) {
			try { await load.fail('❌ ' + (e?.message || 'Gagal membuat stiker animasi brat.')); }
			catch { await m.reply('❌ ' + (e?.message || 'Gagal membuat stiker animasi brat.')); }
		}
	},
};
