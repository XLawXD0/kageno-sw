'use strict';
// Command: prefix — atur prefix command dan restart server otomatis.
// Kategori: owner

import fs from 'fs';
import path from 'path';

export default {
	name: 'prefix',
	aliases: ['setprefix', 'changeprefix', 'prefixcmd'],
	category: 'owner',
	desc: 'Atur prefix command bot dan restart otomatis',
	async run(ctx) {
		const { m, query } = ctx;
		const newPrefix = (query || '').trim();

		if (!newPrefix) {
			const current = process.env.BOT_PREFIX || '!';
			await m.reply(
				`⚙️ *BOT PREFIX CONFIGURATION*\n\n` +
				`Prefix saat ini: \`${current}\`\n\n` +
				`*Cara Pakai:*\n` +
				`• \`.prefix /\` — Ubah prefix menjadi \`/\`\n` +
				`• \`.prefix !\` — Ubah prefix menjadi \`!\`\n` +
				`• \`.prefix .\` — Ubah prefix menjadi \`.\``
			);
			return;
		}

		if (newPrefix.length > 3) {
			await m.reply('❌ Prefix terlalu panjang (maksimal 3 karakter).');
			return;
		}

		const settingsPath = path.join(process.cwd(), 'settings.js');
		try {
			const src = fs.readFileSync(settingsPath, 'utf-8');
			const safe = newPrefix.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
			if (!/BOT_PREFIX:\s*'[^']*'/.test(src)) throw new Error('entri BOT_PREFIX tidak ditemukan di settings.js');
			fs.writeFileSync(settingsPath, src.replace(/BOT_PREFIX:\s*'[^']*'/, `BOT_PREFIX: '${safe}'`));
			process.env.BOT_PREFIX = newPrefix;

			await m.reply(`✅ Prefix berhasil diubah menjadi: *${newPrefix}*\n🔄 Server sedang merestart untuk menerapkan prefix baru...`);

			setTimeout(() => {
				process.exit(0);
			}, 1000);
		} catch (e) {
			await m.reply('❌ Gagal mengubah prefix: ' + (e?.message || e));
		}
	},
};
