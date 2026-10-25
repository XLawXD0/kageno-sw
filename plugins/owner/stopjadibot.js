'use strict';
// Command: stopjadibot — matikan clone dari dalam clone itu sendiri.
// Kategori: owner

import * as shared from '../_shared.js';

export default {
	name: 'stopjadibot',
	aliases: ['stopclone'],
	category: 'owner',
	desc: 'Stop bot clone (dipakai di dalam clone)',
	async run(ctx) {
		const { hisoka, m } = ctx;

		if (!hisoka._isClone) {
			await m.reply('❌ Command ini hanya bisa dipakai dari dalam bot clone.');
			return;
		}

		const { getJadibotByBotJid, stopJadibot } = await import('../../helper/jadibot.js');
		const found = getJadibotByBotJid(hisoka.user?.id);

		if (!found) {
			await m.reply('❌ Tidak bisa menemukan entry clone-nya. Coba restart bot utama.');
			return;
		}

		await m.reply('🛑 Mematikan clone...');
		setTimeout(async () => {
			try { await stopJadibot(found.ownerJid); } catch {}
		}, 1500);
	},
};