'use strict';
// Command: storyadd (per-instance)

import * as shared from '../_shared.js';
const { loadStoryCfg, saveStoryCfg } = shared;

export default {
	name: 'storyadd',
	aliases: [],
	category: 'other',
	desc: 'Tambah link TikTok ke antrian story',
	async run(ctx) {
		const { hisoka, m, query } = ctx;
		const raw = (query || '').trim();
		if (!raw || !/tiktok\.com/i.test(raw)) {
			await m.reply('Kirim link TikTok-nya. Contoh: `.storyadd https://www.tiktok.com/@user/video/123`');
			return;
		}
		const cfg = loadStoryCfg(hisoka);
		if (cfg.queue.some(q => q.url === raw)) { await m.reply('Link itu udah ada di antrian.'); return; }
		cfg.queue.push({ url: raw, addedAt: new Date().toISOString() });
		saveStoryCfg(cfg, hisoka);
		await m.reply(`✅ Ditambahkan ke antrian story (no. ${cfg.queue.length}).\nTotal: ${cfg.queue.length} video.`);
	},
};
