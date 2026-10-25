'use strict';
// Contoh pesan bertombol interaktif (native flow) — command: tombol
// Tombol reply/list yang diketuk akan tiba sebagai teks berisi id-nya,
// jadi id berupa command (.menu, .ping) langsung menjalankan command itu.

export default {
	name: 'tombol',
	aliases: ['button', 'buttons'],
	category: 'tools',
	desc: 'Contoh pesan bertombol interaktif',
	async run(ctx) {
		const { hisoka, m } = ctx;
		const chat = m.key.remoteJid;
		const owner = (process.env.BOT_NUMBER_OWNER || '').split(',')[0].trim();
		const waTarget = owner || (hisoka.user?.id || '').replace(/[^0-9]/g, '');

		const buttons = [
			{ type: 'reply', text: '📋 Buka Menu', id: '.menu' },
			{ type: 'reply', text: '🏓 Ping', id: '.ping' },
			{
				type: 'list',
				text: '⚡ Perintah Cepat',
				title: 'Pilih Perintah',
				sections: [
					{
						title: 'Perintah',
						rows: [
							{ title: 'Menu Utama', description: 'Tampilkan semua fitur', id: '.menu' },
							{ title: 'Ping', description: 'Cek kecepatan respon bot', id: '.ping' },
						],
					},
				],
			},
			...(waTarget ? [{ type: 'url', text: '💬 Chat Owner', url: `https://wa.me/${waTarget}` }] : []),
			{ type: 'copy', text: '📄 Salin Kode', code: 'KAGENO' },
			...(owner ? [{ type: 'call', text: '📞 Telepon Owner', phone: owner }] : []),
		];

		try {
			await hisoka.sendMessage(
				chat,
				{
					text: 'Halo! Ini contoh pesan *bertombol interaktif*.\nSilakan ketuk tombol di bawah — tombol Menu & Ping akan menjalankan command-nya langsung.',
					footer: 'Tombol interaktif • botsw zapo',
					buttons,
				},
				{ quoted: m }
			);
		} catch (err) {
			await m.reply('Gagal mengirim tombol: ' + (err?.message || err));
		}
	},
};
