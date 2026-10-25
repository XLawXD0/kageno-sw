'use strict';
// Command: swemoji (per-instance)

import * as shared from '../_shared.js';
const { readSwConfig, writeSwConfig, extractEmojis } = shared;

export default {
	name: 'swemoji',
	aliases: [],
	category: 'STATUS',
	desc: 'Ganti emoji pool status',
	async run(ctx) {
		const { hisoka, m, query } = ctx;
		const emojis = extractEmojis(query);
		if (!emojis.length) {
			const sw = readSwConfig(hisoka);
			await m.reply(`🎲 Emoji pool (${sw.emoji_pool.length}): ${sw.emoji_pool.join(' ') || '-'}\n\n_Ganti: .swemoji 😍 🔥 👍_`);
			return;
		}
		const sw = writeSwConfig({ emoji_pool: emojis }, hisoka);
		await m.reply(`🎲 Emoji pool diganti (${sw.emoji_pool.length}): ${sw.emoji_pool.join(' ')}`);
	},
};
