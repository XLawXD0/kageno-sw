'use strict';
// Command: swread / swreact / swrandom / swreply (per-instance)

import * as shared from '../_shared.js';
const { readSwConfig, writeSwConfig } = shared;

export default {
	name: 'swread',
	aliases: ['swreact', 'swrandom', 'swreply'],
	category: 'STATUS',
	desc: 'Toggle fitur status',
	async run(ctx) {
		const { hisoka, m, query } = ctx;
		const v = (query || '').trim().toLowerCase();
		const val =
			['on', '1', 'true', 'nyala', 'ya'].includes(v) ? true :
			['off', '0', 'false', 'mati', 'tidak'].includes(v) ? false : null;
		if (val === null) { await m.reply(`Pakai: .${m.command} on  atau  .${m.command} off`); return; }
		const keyMap = { swread: 'autoread', swreact: 'autoreact', swreply: 'autoreply', swrandom: 'random_emoji' };
		const labelMap = { swread: 'Auto-read', swreact: 'Auto-react', swreply: 'Auto-reply teks', swrandom: 'Mode acak' };
		const key = keyMap[m.command];
		const label = labelMap[m.command];
		const sw = writeSwConfig({ [key]: val }, hisoka);
		await m.reply(
			`${label} sekarang *${val ? 'ON ✅' : 'OFF ❌'}*` +
			(key === 'random_emoji' && val ? `\n_React status acak dari: ${sw.emoji_pool.join(' ')}_` : '') +
			(key === 'autoreply' && val ? `\n_Balas status dengan teks: "${sw.reply_text}"_\n_Ubah: .swreplytext <teks>_` : '')
		);
	},
};
