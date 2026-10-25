'use strict';
// Command: storydel (per-instance)

import * as shared from '../_shared.js';
const { loadStoryCfg, saveStoryCfg } = shared;

export default {
	name: 'storydel',
	aliases: [],
	category: 'other',
	desc: 'Hapus item dari antrian story',
	async run(ctx) {
		const { hisoka, m, query } = ctx;
		const n = parseInt((query || '').trim(), 10);
		const cfg = loadStoryCfg(hisoka);
		if (!n || n < 1 || n > cfg.queue.length) {
			await m.reply(`Nomornya 1-${cfg.queue.length}. Contoh: .storydel 2`);
			return;
		}
		const [rm] = cfg.queue.splice(n - 1, 1);
		if (cfg.index >= cfg.queue.length) cfg.index = 0;
		saveStoryCfg(cfg, hisoka);
		await m.reply(`🗑️ Dihapus dari antrian:\n${rm.url}`);
	},
};
