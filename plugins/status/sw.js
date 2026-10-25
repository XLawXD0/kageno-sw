'use strict';
// Command: sw — panel status (per-instance)

import * as shared from '../_shared.js';
const { readSwConfig } = shared;

export default {
	name: 'sw',
	aliases: [],
	category: 'STATUS',
	desc: 'Panel status',
	async run(ctx) {
		const { hisoka, m } = ctx;
		const sw = readSwConfig(hisoka);
		const on = v => (v ? 'ON ✅' : 'OFF ❌');
		await m.reply(
			`👁️ *STATUS MONITOR*\n\n` +
			`• Auto-read: ${on(sw.autoread)}\n` +
			`• Auto-react: ${on(sw.autoreact)}\n` +
			`• Auto-reply: ${on(sw.autoreply)} ("${sw.reply_text}")\n` +
			`• React teks: ${sw.react_text ? `"${sw.react_text}"` : '-'}\n` +
			`• Bio uptime: ${on(sw.uptimebio)}\n` +
			`• Mode acak: ${on(sw.random_emoji)}\n` +
			`• Emoji pool (${sw.emoji_pool.length}): ${sw.emoji_pool.join(' ') || '-'}\n\n` +
			`_Atur: .swread on/off | .swreact on/off | .swreply on/off | .swreplytext <teks> | .swreacttext <tulisan> | .uptimebio on/off | .swrandom on/off | .swemoji 😍🔥_`
		);
	},
};
