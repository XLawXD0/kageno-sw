'use strict';
// Command: jadibot — bikin bot clone (owner only).
// Kategori: owner

import * as shared from '../_shared.js';
const { fs } = shared;

const cleanNum = n => String(n).replace(/[^0-9]/g, '');

export default {
	name: 'jadibot',
	aliases: ['clonebot'],
	category: 'owner',
	desc: 'Clone bot ke nomor lain',
	async run(ctx) {
		const { hisoka, m, query } = ctx;

		// Blokir di dalam clone
		if (hisoka._isClone) {
			await m.reply('❌ Fitur jadibot tidak tersedia di dalam clone.');
			return;
		}

		const arg = (query || '').trim();
		const { createJadibot, stopJadibot, listJadibots } = await import('../../helper/jadibot.js');

		// Tanpa argumen → tampilkan panduan
		if (!arg) {
			await m.reply(
				`🤖 *JADIBOT — CLONE BOT*\n\n` +
				`• \`.jadibot <nomor>\` — jadi bot di nomor lain\n` +
				`  Contoh: \`.jadibot 628123456789\`\n\n` +
				`• \`.jadibot limit <nomor> <durasi>\` — atur/perpanjang batasan durasi aktif\n` +
				`  Contoh: \`.jadibot limit 628123456789 1h\` (30m, 1h, 2h, 30d)\n` +
				`  _Durasi habis → session disimpan 1 hari, bisa diperpanjang tanpa pairing ulang._\n\n` +
				`• \`.jadibot list\` — lihat clone aktif & sisa durasi\n` +
				`• \`.jadibot stop <nomor>\` — matikan clone`
			);
			return;
		}

		// list
		if (arg.toLowerCase() === 'list') {
			const { fmtDuration } = await import('../../helper/jadibot.js');
			const clones = listJadibots();
			if (!clones.length) {
				await m.reply('📭 Belum ada clone bot yang aktif.');
				return;
			}
			const lines = clones.map((c, i) => {
				const botNum = (c.botJid || '').split('@')[0] || c.targetNumber || '?';
				const ownerNum = (c.ownerJid || '').split('@')[0] || '?';
				const timer = c.connectedAt ? fmtDuration(Date.now() - c.connectedAt) : 'Mati (Terputus)';
				const limitStr = c.durationLimitMs ? `\n   ⏳ Durasi Limit: ${fmtDuration(c.durationLimitMs)} (Sisa: ${fmtDuration(c.remainingDurationMs)})` : '';
				const expiredStr = c.status === 'expired'
					? `\n   💾 Masa tenggang: ${fmtDuration(c.graceRemainingMs)} (perpanjang via \`.jadibot limit ${c.targetNumber} <durasi>\`)`
					: '';
				const statusLabel = c.status === 'expired' ? 'expired (tenggang)' : c.status;
				return `${i + 1}. *${botNum}* — ${statusLabel}\n   Owner: ${ownerNum}\n   ⏱️ Timer: ${timer}${limitStr}${expiredStr}`;
			});
			await m.reply(`🤖 *Clone (${clones.length}):*\n\n${lines.join('\n\n')}`);
			return;
		}

		// limit <nomor> <durasi>
		if (arg.toLowerCase().startsWith('limit ') || arg.toLowerCase().startsWith('duration ')) {
			const parts = arg.split(/\s+/);
			const num = cleanNum(parts[1] || '');
			const dur = parts[2] || '';
			if (!num || !dur) {
				await m.reply('Contoh: `.jadibot limit 628123456789 1h`\n(Format durasi: s = detik, m = menit, h = jam, d = hari)');
				return;
			}
			try {
				const { setJadibotLimit, fmtDuration, getJadibotByNumber } = await import('../../helper/jadibot.js');
				const wasExpired = getJadibotByNumber(num)?.status === 'expired';
				if (wasExpired) await m.reply(`🔄 Memperpanjang & menghidupkan lagi clone *${num}*...`);
				const ms = await setJadibotLimit(num, dur, hisoka, m.from);
				await m.reply(
					(wasExpired ? `✅ Clone *${num}* hidup lagi tanpa pairing ulang!\n` : `✅ Berhasil mengatur durasi limit untuk clone *${num}* menjadi `) +
					(wasExpired ? '' : `*${fmtDuration(ms)}*. `) +
					(wasExpired ? `Durasi baru: *${fmtDuration(ms)}*.` : `Bot akan otomatis mati saat durasi habis (session disimpan 1 hari).`)
				);
			} catch (err) {
				await m.reply('❌ ' + (err?.message || 'Gagal mengatur durasi limit.'));
			}
			return;
		}

		// stop <nomor>
		if (arg.toLowerCase().startsWith('stop ')) {
			const num = cleanNum(arg.slice(5));
			if (!num) { await m.reply('Contoh: `.jadibot stop 628123456789`'); return; }

			// Cari clone yang botJid-nya punya nomor ini
			const { getJadibotByBotJid, getJadibotByNumber } = await import('../../helper/jadibot.js');
			const found = getJadibotByBotJid(`${num}@s.whatsapp.net`);

			if (!found) {
				// Coba cari by nomor (termasuk yang sedang expired/tenggang)
				const byNum = getJadibotByNumber(num);
				if (byNum) {
					await stopJadibot(byNum.key);
					await m.reply(`✅ Clone ${num} dimatikan & session dihapus.`);
					return;
				}
				// Mungkin owner langsung — coba cari by owner
				const entry = global.jadibots?.[`${num}@s.whatsapp.net`];
				if (!entry) { await m.reply(`❌ Clone dengan nomor ${num} tidak ditemukan.`); return; }
				await stopJadibot(`${num}@s.whatsapp.net`);
			} else {
				await stopJadibot(found.ownerJid);
			}
			await m.reply(`✅ Clone ${num} dimatikan.`);
			return;
		}

		// Start clone: .jadibot <nomor>
		const num = cleanNum(arg);
		if (!num || num.length < 10) {
			await m.reply('❌ Nomor tidak valid. Contoh: `.jadibot 628123456789`');
			return;
		}

		await m.reply(`🔄 Meminta pairing code untuk ${num}...\nTunggu sebentar...`);

		try {
			await createJadibot({
				conn: hisoka,
				ownerJid: m.sender,
				targetNumber: num,
				notifyJid: m.from,
				m,
			});
		} catch (err) {
			await m.reply('❌ ' + (err?.message || 'Gagal membuat clone.'));
		}
	},
};
