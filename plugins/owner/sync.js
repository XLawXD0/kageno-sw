'use strict';
// Command: sync / synccontacts / reloadcontact
// Paksa WA kirim ulang daftar kontak (termasuk nama phonebook).
// Kategori: owner

import * as shared from '../_shared.js';
const { fs, path } = shared;

export default {
	name: 'sync',
	aliases: ['synccontacts', 'reloadcontact', 'syncc'],
	category: 'owner',
	desc: 'Paksa sync kontak dari WA (nama phonebook)',
	async run(ctx) {
		const { hisoka, m, query } = ctx;
		const arg = (query || '').trim().toLowerCase();

		// Cek dulu jumlah kontak saat ini
		let totalBefore = 0;
		let withName = 0;
		try {
			totalBefore = hisoka.contacts.size;
			for (const c of hisoka.contacts.values()) {
				if (c?.name) withName++;
			}
		} catch {}

		// Statistik
		if (arg === 'stat' || arg === 'status') {
			await m.reply(
				`📇 *STATUS KONTAK*\n\n` +
				`• Total entri    : ${totalBefore}\n` +
				`• Punya nama     : ${withName}\n` +
				`• Cuma pushName  : ${totalBefore - withName}\n\n` +
				`_Jalankan: .sync_`
			);
			return;
		}

		// Paksa resync
		await m.reply(`🔄 Meminta WA resync app state...\n\nTotal kontak saat ini: ${totalBefore}`);
		try {
			await hisoka.resyncAppState(
				['critical_unblock_low', 'regular_low', 'regular_high'],
				true
			);
			await m.reply('⏳ Resync dikirim. Tunggu ~30 detik, lalu jalankan `.sync stat`.');
		} catch (err) {
			await m.reply('❌ Resync gagal: ' + (err?.message || err));
		}
	},
};