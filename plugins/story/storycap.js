'use strict';
// Command: storycap (per-instance)

import * as shared from '../_shared.js';
const { loadStoryCfg, saveStoryCfg } = shared;

export default {
	name: 'storycap',
	aliases: [],
	category: 'other',
	desc: 'Set caption story',
	async run(ctx) {
		const { hisoka, m, query } = ctx;
		const cfg = loadStoryCfg(hisoka);
		cfg.caption = (query || '').trim();
		saveStoryCfg(cfg, hisoka);
		await m.reply(cfg.caption ? `✏️ Caption story: "${cfg.caption}"` : '✏️ Caption dikosongkan (pakai judul video).');
	},
};
