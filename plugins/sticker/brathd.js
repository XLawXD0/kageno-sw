'use strict';
// Command: brathd — stiker brat HD dari teks via ScrLxrd REST API.

import { apiMediaBuffer, getApiKey } from '../../helper/scrlxrd-api.js';
import { bufferToSticker } from '../../helper/sticker.js';

export default {
	name: 'brathd',
	aliases: [],
	category: 'sticker',
	desc: 'Bikin stiker brat HD dari teks\n\nContoh: `.brathd halo dunia`',
	async run(ctx) {
		const { hisoka, m, query } = ctx;
		const text = (query || '').trim();
		if (!text) {
			await m.reply('Kasih teksnya. Contoh: `.brathd halo dunia`');
			return;
		}
		if (!getApiKey()) {
			await m.reply('❌ SCRLXRD_API_KEY belum diset di settings.js');
			return;
		}
		const { startLoading } = await import('../../helper/loading.js');
		const load = await startLoading(hisoka, m, 'Membuat stiker brat HD');
		try {
			const img = await apiMediaBuffer('/api/maker/brathd', { text });
			const sticker = await bufferToSticker(img);
			await load.stop();
			await hisoka.sendMessage(m.from, { sticker }, { quoted: m });
		} catch (e) {
			try { await load.fail('❌ ' + (e?.message || 'Gagal membuat stiker brat HD.')); }
			catch { await m.reply('❌ ' + (e?.message || 'Gagal membuat stiker brat HD.')); }
		}
	},
};
