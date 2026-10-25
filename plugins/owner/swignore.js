'use strict';
// Command: swignore / ignorereact — atur kontak yang di-ignore dari auto read / react SW.
// Kategori: owner

import { loadSwIgnore, saveSwIgnore } from '../../helper/swignore.js';

const cleanNum = n => String(n).replace(/[^0-9]/g, '');

export default {
	name: 'swignore',
	aliases: ['ignorereact', 'ignoreread', 'ignorecontact', 'swblock'],
	category: 'owner',
	desc: 'Atur kontak ignore dari read/react status (SW)',
	async run(ctx) {
		const { hisoka, m, query, command } = ctx;
		const arg = (query || '').trim();
		const data = loadSwIgnore(hisoka);

		const isReactOnly = (command || '').toLowerCase() === 'ignorereact' || arg.toLowerCase().startsWith('react ');
		const isReadOnly = (command || '').toLowerCase() === 'ignoreread' || arg.toLowerCase().startsWith('read ');

		let targetArg = arg;
		if (isReactOnly && arg.toLowerCase().startsWith('react ')) {
			targetArg = arg.slice(6).trim();
		} else if (isReadOnly && arg.toLowerCase().startsWith('read ')) {
			targetArg = arg.slice(5).trim();
		}

		if (!targetArg) {
			const readList = data.read.length ? data.read.map((v, i) => `${i + 1}. \`${v}\``).join('\n') : '_Kosong_';
			const reactList = data.react.length ? data.react.map((v, i) => `${i + 1}. \`${v}\``).join('\n') : '_Kosong_';
			await m.reply(
				`🚫 *SW IGNORE CONFIGURATION*\n\n` +
				`*1. Ignore Read (Tidak di-read SW-nya):*\n${readList}\n\n` +
				`*2. Ignore React (Tidak di-react SW-nya / Masih di-read):*\n${reactList}\n\n` +
				`*Cara Pakai:*\n` +
				`• \`.ignorereact <nomor>\` — Ignore react saja (masih bisa read)\n` +
				`• \`.ignoreread <nomor>\` — Ignore read saja\n` +
				`• \`.swignore <nomor>\` — Ignore read & react sekaligus\n` +
				`• \`.swignore clear\` — Hapus semua`
			);
			return;
		}

		const parts = targetArg.split(/\s+/);
		const sub = parts[0].toLowerCase();

		if (sub === 'clear') {
			saveSwIgnore(hisoka, { read: [], react: [] });
			await m.reply('✅ Berhasil mengosongkan semua daftar SW ignore.');
			return;
		}

		let targetNum = '';
		let actionType = 'both'; // 'read', 'react', or 'both'

		if (isReactOnly) actionType = 'react';
		else if (isReadOnly) actionType = 'read';

		if (sub === 'read') {
			actionType = 'read';
			targetNum = cleanNum(parts[1] || '');
		} else if (sub === 'react') {
			actionType = 'react';
			targetNum = cleanNum(parts[1] || '');
		} else if (sub === 'add' || sub === 'del' || sub === 'remove') {
			targetNum = cleanNum(parts[1] || '');
		} else {
			targetNum = cleanNum(sub);
		}

		if (!targetNum || targetNum.length < 5) {
			await m.reply('❌ Nomor tidak valid. Contoh: `.ignorereact 628123456789`');
			return;
		}

		const isDel = sub === 'del' || sub === 'remove';

		let nextRead = [...data.read];
		let nextReact = [...data.react];

		if (actionType === 'react' || actionType === 'both') {
			const exists = nextReact.includes(targetNum);
			if (isDel || exists) {
				nextReact = nextReact.filter(x => cleanNum(x) !== targetNum);
			} else {
				nextReact.push(targetNum);
			}
		}

		if (actionType === 'read' || actionType === 'both') {
			const exists = nextRead.includes(targetNum);
			if (isDel || exists) {
				nextRead = nextRead.filter(x => cleanNum(x) !== targetNum);
			} else {
				nextRead.push(targetNum);
			}
		}

		saveSwIgnore(hisoka, { read: nextRead, react: nextReact });

		const modeLabel = actionType === 'react' ? 'Ignore React (Tetap di-read)' : actionType === 'read' ? 'Ignore Read' : 'Ignore Read & React';
		await m.reply(`✅ Berhasil memperbarui daftar *${modeLabel}* untuk nomor *${targetNum}*.`);
	},
};
