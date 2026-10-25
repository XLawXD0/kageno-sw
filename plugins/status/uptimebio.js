'use strict';
// Command: uptimebio (per-instance, nama KAGENO)

import * as shared from '../_shared.js';
const { readSwConfig, writeSwConfig } = shared;

export default {
	name: 'uptimebio',
	aliases: [],
	category: 'STATUS',
	desc: 'Toggle bio uptime otomatis',
	async run(ctx) {
		const { hisoka, m, query } = ctx;
		const v = (query || '').trim().toLowerCase();
		const val =
			['on', '1', 'true', 'nyala', 'ya'].includes(v) ? true :
			['off', '0', 'false', 'mati', 'tidak'].includes(v) ? false : null;
		if (val === null) {
			const sw = readSwConfig(hisoka);
			await m.reply(`⏱️ Bio uptime: *${sw.uptimebio ? 'ON ✅' : 'OFF ❌'}*\n\n_Pakai: .uptimebio on / off_`);
			return;
		}
		writeSwConfig({ uptimebio: val }, hisoka);
		if (val) {
			try {
				const s = Math.floor(process.uptime());
				const h = Math.floor(s / 3600);
				const mnt = Math.floor((s % 3600) / 60);
				const up = h > 0 ? `${h}j ${mnt}m` : `${mnt}m`;
				const bio = `🟢 KAGENO • Online ⏱️ ${up}`;
				await hisoka.updateProfileStatus(bio);
			} catch (err) {
				console.error('[uptimebio] gagal:', err?.message || err);
				await m.reply(`⚠️ Gagal update bio: ${err?.message || err}`);
			}
		}
		await m.reply(`⏱️ Bio uptime → *${val ? 'ON ✅' : 'OFF ❌'}*`);
	},
};
