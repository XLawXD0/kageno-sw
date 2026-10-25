'use strict';
// Command: brat — stiker brat dari teks via ScrLxrd REST API.

import { apiMediaBuffer, getApiKey } from '../../helper/scrlxrd-api.js';
import { bufferToSticker } from '../../helper/sticker.js';

export default {
	name: 'brat',
	aliases: [],
	category: 'sticker',
	desc: 'Bikin stiker brat dari teks\n\nContoh: `.brat halo dunia`',
	async run(ctx) {
		const { hisoka, m, query } = ctx;
		const text = (query || '').trim();
		if (!text) {
			await m.reply('Kasih teksnya. Contoh: `.brat halo dunia`');
			return;
		}
		if (!getApiKey()) {
			await m.reply('❌ SCRLXRD_API_KEY belum diset di settings.js');
			return;
		}
		const { startLoading } = await import('../../helper/loading.js');
		const load = await startLoading(hisoka, m, 'Membuat stiker brat');
		try {
			const img = await apiMediaBuffer('/api/maker/brat', { text });
			const sticker = await bufferToSticker(img);
			await load.stop();
			await hisoka.sendMessage(m.from, { sticker }, { quoted: m });
		} catch (e) {
			try { await load.fail('❌ ' + (e?.message || 'Gagal membuat stiker brat.')); }
			catch { await m.reply('❌ ' + (e?.message || 'Gagal membuat stiker brat.')); }
		}
	},
};
