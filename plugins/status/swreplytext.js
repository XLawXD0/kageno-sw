'use strict';
// Command: swreplytext (per-instance)

import * as shared from '../_shared.js';
const { readSwConfig, writeSwConfig } = shared;

export default {
	name: 'swreplytext',
	aliases: [],
	category: 'STATUS',
	desc: 'Set teks auto-reply status',
	async run(ctx) {
		const { hisoka, m, query } = ctx;
		const teks = (query || '').trim();
		if (!teks) {
			const sw = readSwConfig(hisoka);
			await m.reply(`💬 Teks auto-reply saat ini: "${sw.reply_text}"\n\n_Ganti: .swreplytext <teks>_`);
			return;
		}
		const sw = writeSwConfig({ reply_text: teks.slice(0, 200) }, hisoka);
		await m.reply(`💬 Teks auto-reply diganti: "${sw.reply_text}"`);
	},
};
