'use strict';
// Command: listjadibot — lihat daftar clone aktif (owner only).
// Kategori: owner

import * as shared from '../_shared.js';

export default {
	name: 'listjadibot',
	aliases: ['clonelist', 'jadibotlist'],
	category: 'owner',
	desc: 'Lihat daftar clone aktif',
	async run(ctx) {
		const { m } = ctx;
		const { listJadibots, fmtDuration } = await import('../../helper/jadibot.js');
		const clones = listJadibots();

		if (!clones.length) {
			await m.reply('📭 Belum ada clone bot yang aktif.');
			return;
		}

		const lines = clones.map((c, i) => {
			const botNum = (c.botJid || '').split('@')[0] || c.targetNumber || '?';
			const ownerNum = (c.ownerJid || '').split('@')[0] || '?';
			const startAt = c.startedAt ? new Date(c.startedAt).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' }) : '-';
			const timer = c.connectedAt ? fmtDuration(Date.now() - c.connectedAt) : 'Mati (Terputus)';
			const limitStr = c.durationLimitMs ? `\n   ⏳ Durasi Limit: ${fmtDuration(c.durationLimitMs)} (Sisa: ${fmtDuration(c.remainingDurationMs)})` : '';
			const expiredStr = c.status === 'expired'
				? `\n   💾 Masa tenggang: ${fmtDuration(c.graceRemainingMs)} (perpanjang via \`.jadibot limit ${c.targetNumber} <durasi>\`)`
				: '';
			const statusLabel = c.status === 'expired' ? 'expired (tenggang)' : c.status;
			return `${i + 1}. *${botNum}* [${statusLabel}]\n   Owner: ${ownerNum}\n   Mulai: ${startAt}\n   ⏱️ Timer: ${timer}${limitStr}${expiredStr}`;
		});

		await m.reply(`🤖 *Clone (${clones.length}):*\n\n${lines.join('\n\n')}`);
	},
};