'use strict';
// Command: storylist (per-instance)

import * as shared from '../_shared.js';
const { loadStoryCfg } = shared;

export default {
	name: 'storylist',
	aliases: [],
	category: 'other',
	desc: 'Lihat antrian story',
	async run(ctx) {
		const { hisoka, m } = ctx;
		const cfg = loadStoryCfg(hisoka);
		const lines = cfg.queue.map((q, i) => `${i + 1}. ${q.url}`).join('\n') || '(kosong)';
		await m.reply(
			`📋 *JADWAL STORY*\n\n` +
			`Status: ${cfg.enabled ? 'ON ✅' : 'OFF ❌'}\n` +
			`Jam (WIB): ${cfg.times.join(', ') || '-'}\n` +
			`Caption: ${cfg.caption || '(judul video)'}\n` +
			(cfg.lastError ? `⚠️ Error terakhir: ${cfg.lastError}\n` : '') +
			`\n🎬 *Antrian (${cfg.queue.length}):*\n${lines}`
		);
	},
};
