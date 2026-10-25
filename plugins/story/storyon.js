'use strict';
// Command: storyon / storyoff (per-instance)

import * as shared from '../_shared.js';
const { loadStoryCfg, saveStoryCfg } = shared;

export default {
	name: 'storyon',
	aliases: ['storyoff'],
	category: 'other',
	desc: 'Toggle auto-posting status',
	async run(ctx) {
		const { hisoka, m } = ctx;
		const cfg = loadStoryCfg(hisoka);
		cfg.enabled = m.command === 'storyon';
		saveStoryCfg(cfg, hisoka);
		await m.reply(cfg.enabled
			? `✅ Auto-posting story *ON*.\nJadwal: ${cfg.times.join(', ')} WIB\nAntrian: ${cfg.queue.length} video.`
			: '❌ Auto-posting story *OFF*.');
	},
};
