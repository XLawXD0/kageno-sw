'use strict';
// Command: storytime (per-instance)

import * as shared from '../_shared.js';
const { loadStoryCfg, saveStoryCfg } = shared;

export default {
	name: 'storytime',
	aliases: [],
	category: 'other',
	desc: 'Set jadwal posting story',
	async run(ctx) {
		const { hisoka, m, query } = ctx;
		const raw = (query || '').trim();
		if (!raw) { await m.reply('Contoh: .storytime 07:00,12:00,18:00'); return; }
		const times = raw.split(/[\s,]+/).filter(t => /^([01]\d|2[0-3]):[0-5]\d$/.test(t));
		if (!times.length) { await m.reply('Format jam salah. Contoh: .storytime 07:00,12:00,18:00'); return; }
		const cfg = loadStoryCfg(hisoka);
		cfg.times = [...new Set(times)].sort();
		saveStoryCfg(cfg, hisoka);
		await m.reply(`⏰ Jadwal story: ${cfg.times.join(', ')} WIB`);
	},
};
