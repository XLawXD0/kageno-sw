'use strict';
// Menu utama (command: menu, aliases: help, ?)

import path from 'path';
import { fileURLToPath } from 'url';

import * as shared from '../_shared.js';
import { loadPlugins } from '../_loader.js';

const { readGcLink, MENU_BANNER, MENU_BANNER_ALT, fs } = shared;

const BANNER_URL = 'https://raw.githubusercontent.com/iyannsysu/iyan-x-m/main/assets/menu-adawong.jpg';

const PLUGINS_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// ==== MENU OTOMATIS ====
// Isi menu digenerate dari plugin yang benar-benar termuat (scan folder
// plugins/ lewat loader yang sama dengan dispatcher). Tambah/hapus/nonaktifkan
// plugin -> menu ikut berubah tanpa edit file ini. Plugin bisa menyembunyikan
// dirinya dari menu dengan `hidden: true` atau `noMenu: true` di ekspornya.
// Daftar FALLBACK_CATEGORIES di bawah hanya dipakai bila scan gagal/kosong.
const FOLDER_STYLE = {
	downloader: { icon: '📥', title: 'DOWNLOADER' },
	sticker: { icon: '🎨', title: 'STIKER' },
	status: { icon: '👁️', title: 'STATUS' },
	fun: { icon: '😄', title: 'FUN' },
	game: { icon: '🎮', title: 'GAME' },
	tools: { icon: '🔧', title: 'TOOLS' },
	islami: { icon: '🕌', title: 'ISLAMI & PRIMBON' },
	dewasa: { icon: '🔞', title: 'DEWASA' },
};
const FOLDER_ORDER = ['downloader', 'sticker', 'status', 'fun', 'game', 'tools', 'islami', 'dewasa'];
// Folder manajemen digabung jadi satu kotak terakhir.
const MERGED_FOLDERS = ['group', 'info', 'owner', 'story'];
const MERGED_STYLE = { icon: '⚙️', title: 'MENU & PENGATURAN' };

let _catsCache = null;
let _catsCacheAt = 0;
async function getCategories() {
	if (_catsCache && Date.now() - _catsCacheAt < 60_000) return _catsCache;
	try {
		const { list } = await loadPlugins(PLUGINS_DIR);
		const byFolder = new Map();
		const seen = new Set();
		for (const p of list) {
			if (!p?.name || p.hidden === true || p.noMenu === true) continue;
			const name = String(p.name).toLowerCase();
			if (seen.has(name)) continue;
			seen.add(name);
			const parts = String(p.file || '').split(/[\\/]/);
			const folder = parts.length > 1 ? parts[0] : 'other';
			if (!byFolder.has(folder)) byFolder.set(folder, []);
			byFolder.get(folder).push(name);
		}
		const cats = [];
		for (const f of FOLDER_ORDER) {
			if (byFolder.has(f)) cats.push({ ...FOLDER_STYLE[f], cmds: byFolder.get(f) });
		}
		for (const [f, cmds] of byFolder) {
			if (FOLDER_ORDER.includes(f) || MERGED_FOLDERS.includes(f)) continue;
			cats.push({ icon: '📁', title: f.toUpperCase(), cmds });
		}
		const merged = MERGED_FOLDERS.flatMap(f => byFolder.get(f) || []);
		if (merged.length) cats.push({ ...MERGED_STYLE, cmds: merged });
		if (cats.length) {
			_catsCache = cats;
			_catsCacheAt = Date.now();
			return cats;
		}
	} catch (e) {
		console.warn('[menu] auto-generate gagal, pakai fallback:', e?.message || e);
	}
	return FALLBACK_CATEGORIES;
}

const FALLBACK_CATEGORIES = [
	{
		icon: '📥',
		title: 'DOWNLOADER',
		cmds: ['tt', 'tiktokv2', 'play', 'play2', 'fb', 'twitter', 'ytsearch', 'sfile', 'pin', 'pixiv', 'ppcouple', 'cosplay'],
	},
	{
		icon: '🎨',
		title: 'STIKER',
		cmds: ['s', 'spack', 'tpack', 'brat', 'brathd', 'bratvid', 'bratvid2'],
	},
	{
		icon: '👁️',
		title: 'STATUS',
		cmds: ['sw', 'swread', 'swreact', 'swreply', 'swreacttext', 'swreplytext', 'swemoji', 'uptimebio', 'rvo', 'react'],
	},
	{
		icon: '😄',
		title: 'FUN',
		cmds: ['afk', 'alay', 'hacker', 'khodam', 'menfess', 'balasmenfess', 'tolakmenfess'],
	},
	{
		icon: '🎮',
		title: 'GAME',
		cmds: ['tebakgambar', 'math', 'nyerah'],
	},
	{
		icon: '🔧',
		title: 'TOOLS',
		cmds: ['tts', 'translate', 'ssweb', 'cuaca', 'q', 'p', 'hd'],
	},
	{
		icon: '🕌',
		title: 'ISLAMI & PRIMBON',
		cmds: ['jadwalsholat', 'doaharian', 'artinama', 'ramalanjodoh', 'zodiak'],
	},
	{
		icon: '⚙️',
		title: 'MENU & PENGATURAN',
		cmds: [
			'menu', 'fwd', 'watch', 'block', 'cek', 'settg', 'jadibot', 'setgc',
			'storyon', 'storyadd', 'storylist', 'storydel', 'storyclear',
			'storycap', 'storytime', 'storynow',
			'contacts', 'groups', 'hidetag',
		],
	},
];

const QUOTES = [
	'Jangan menunggu sempurna, buat momenmu sempurna.',
	'Berani mencoba adalah awal kesuksesan.',
	'Hari ini lelah, besok bangga.',
	'Fokus proses, hasil mengikuti.',
	'Mimpi tanpa aksi hanyalah angan.',
	'Maju sedikit tiap hari itu cukup.',
	'Gagal itu guru, asal mau belajar.',
	'Jadilah versi terbaik dirimu.',
	'Waktu terbaik mulai adalah sekarang.',
	'Kerja keras kalahkan bakat malas.',
	'Pelan tak apa, asal jangan diam.',
	'Hal besar mulai dari langkah kecil.',
];

const TZ = 'Asia/Jakarta';
const BOT_NAME = 'KAGENO';

function sapaan() {
	const jam = Number(
		new Intl.DateTimeFormat('en-GB', { hour: '2-digit', hour12: false, timeZone: TZ }).format(new Date())
	) % 24;
	if (jam >= 4 && jam < 11) return { teks: 'Selamat pagi', emoji: '🌅' };
	if (jam >= 11 && jam < 15) return { teks: 'Selamat siang', emoji: '☀️' };
	if (jam >= 15 && jam < 18) return { teks: 'Selamat sore', emoji: '🌇' };
	return { teks: 'Selamat malam', emoji: '🌙' };
}

function uptimeText() {
	const up = Math.floor(process.uptime());
	const d = Math.floor(up / 86400);
	const h = Math.floor((up % 86400) / 3600);
	const mnt = Math.floor((up % 3600) / 60);
	return d > 0 ? `${d}h ${h}j ${mnt}m` : h > 0 ? `${h}j ${mnt}m` : `${mnt}m`;
}

function buildMenu({ who, ownerName, gcLink, cats }) {
	const now = new Date();
	const tanggal = now.toLocaleDateString('id-ID', {
		weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: TZ,
	});
	const jam = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', timeZone: TZ }).replace(':', '.');
	const total = cats.reduce((n, c) => n + c.cmds.length, 0);
	const { teks, emoji } = sapaan();
	const quote = QUOTES[Math.floor(Math.random() * QUOTES.length)];

	const head =
		`✰────── *${BOT_NAME}* ──────✰\n\n` +
		`Halo, *${who}*! ${teks} ${emoji}\n` +
		`_"${quote}"_\n\n` +
		`╭─❏ *INFORMASI*\n` +
		`│ 👑 Owner   : ${ownerName}\n` +
		`│ ⏱️ Online  : ${uptimeText()}\n` +
		`│ 📅 Tanggal : ${tanggal}\n` +
		`│ 🕒 Jam     : ${jam} WIB\n` +
		`│ 📚 Fitur   : ${total} command\n` +
		`╰──────────────\n`;

	const body = cats.map(c =>
		`\n╭─❏ ${c.icon} *${c.title}*\n` +
		c.cmds.map(cmd => `│ ✧ .${cmd}`).join('\n') +
		`\n╰──────────────`
	).join('\n');

	const foot =
		`\n\n💡 _Ketik .menu untuk tampilkan ulang_\n` +
		(gcLink ? `👥 *Grup WA*\n🔗 ${gcLink}\n\n` : '\n') +
		`✰ ⚝ ${BOT_NAME} • by *${ownerName}* ✰`;

	return { text: head + body + foot, total };
}

export default {
	name: 'menu',
	aliases: ['help', '?'],
	category: 'other',
	desc: 'Menampilkan daftar menu',
	async run(ctx) {
		const { hisoka, m } = ctx;
		const ownerName = process.env.BOT_OWNER_NAME || 'Owner';
		const who = m.pushName || ownerName;
		const gcLink = readGcLink(hisoka);
		const cats = await getCategories();
		const { text, total } = buildMenu({ who, ownerName, gcLink, cats });
		const style = (process.env.BOT_MENU_STYLE || 'card').toLowerCase();

		// Pilih banner yang ada
		let bannerPath = MENU_BANNER;
		try { fs.accessSync(bannerPath); } catch { bannerPath = MENU_BANNER_ALT; }

		if (style !== 'image') {
			try {
				let thumbnail;
				try {
					const buf = fs.readFileSync(bannerPath);
					if (buf.length < 300 * 1024) thumbnail = buf;
				} catch {}

				const ownerNum = (process.env.BOT_NUMBER_OWNER || '').split(',')[0].trim();
				await hisoka.sendMessage(
					m.from,
					{
						text,
						contextInfo: {
							externalAdReply: {
								title: `✰ ${BOT_NAME} ✰`,
								body: `Online ${uptimeText()} • ${total} fitur`,
								mediaType: 1,
								renderLargerThumbnail: true,
								showAdAttribution: false,
								...(thumbnail ? { thumbnail } : { thumbnailUrl: BANNER_URL }),
								sourceUrl: gcLink || (ownerNum ? `https://wa.me/${ownerNum}` : BANNER_URL),
							},
						},
					},
					{ quoted: m }
				);
				return;
			} catch (e) {
				console.warn('[menu] gaya kartu gagal, pakai gambar:', e?.message || e);
			}
		}

		const sendImage = async caption => {
			try {
				await hisoka.sendMessage(
					m.from,
					caption ? { image: { url: BANNER_URL }, caption } : { image: { url: BANNER_URL } },
					{ quoted: m }
				);
			} catch {
				const banner = fs.readFileSync(bannerPath);
				await hisoka.sendMessage(
					m.from,
					caption ? { image: banner, caption } : { image: banner },
					{ quoted: m }
				);
			}
		};
		try {
			if (Buffer.byteLength(text, 'utf8') > 1000) {
				await sendImage(null);
				await m.reply(text);
			} else {
				await sendImage(text);
			}
		} catch {
			await m.reply(text);
		}
	},
};
