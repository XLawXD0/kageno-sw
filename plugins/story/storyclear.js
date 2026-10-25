'use strict';
// Command: storyclear (per-instance)

import * as shared from '../_shared.js';
const { loadStoryCfg, saveStoryCfg } = shared;

export default {
	name: 'storyclear',
	aliases: [],
	category: 'other',
	desc: 'Kosongkan antrian story',
	async run(ctx) {
		const { hisoka, m } = ctx;
		const cfg = loadStoryCfg(hisoka);
		cfg.queue = []; cfg.index = 0;
		saveStoryCfg(cfg, hisoka);
		await m.reply('🗑️ Antrian story dikosongkan.');
	},
};
