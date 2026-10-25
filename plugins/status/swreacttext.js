'use strict';
// Command: swreacttext / ubahreact (per-instance)

import * as shared from '../_shared.js';
const { readSwConfig, writeSwConfig } = shared;

export default {
	name: 'swreacttext',
	aliases: ['ubahreact'],
	category: 'STATUS',
	desc: 'Set tulisan react status',
	async run(ctx) {
		const { hisoka, m, query } = ctx;
		const sw = readSwConfig(hisoka);
		const teks = (query || '').trim().toLowerCase();
		if (teks === 'off' || teks === 'kosong') {
			writeSwConfig({ react_text: '' }, hisoka);
			await m.reply(`🔤 React teks dimatikan, balik pakai emoji.`);
			return;
		}
		const input = (query || '').trim();
		if (!input) {
			await m.reply(`🔤 React teks saat ini: "${sw.react_text || '-'}"\n\n_Pakai: .swreacttext <tulisan>_\n_Acak: .swreacttext teks1 | teks2 | teks3_\n_Matikan: .swreacttext off_`);
			return;
		}
		const opts = input.split('|').map(s => s.trim().slice(0, 30)).filter(Boolean);
		if (!opts.length) { await m.reply('Tulisannya kosong.'); return; }
		writeSwConfig({ react_text: opts.join(' | ') }, hisoka);
		await m.reply(opts.length > 1
			? `🔤 React status ACAK dari ${opts.length} tulisan:\n${opts.map((o, i) => `${i + 1}. "${o}"`).join('\n')}`
			: `🔤 React status pakai tulisan: "${opts[0]}"`);
	},
};
