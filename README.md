# botsw — WhatsApp Bot (zapo-js-mod)

Script bot WhatsApp modern berbasis **[zapo-js-mod](https://www.npmjs.com/package/zapo-js-mod)**:
multi-fitur, sistem plugin per kategori, jadibot multi-nomor, login kode
pairing, dan tombol interaktif. Cocok dipakai sebagai bot pribadi, bot grup,
maupun base untuk dikembangkan lagi.

![Node.js](https://img.shields.io/badge/Node.js-%3E%3D20.9-green)
![License](https://img.shields.io/badge/license-MIT-blue)

## ✨ Fitur

- **Downloader** — TikTok, YouTube (audio/video & pencarian), Facebook, Twitter/X, Sfile
- **Sticker** — buat stiker dari gambar/video, brat, paket stiker WhatsApp & Telegram
- **Status (SW)** — baca & simpan status, buka media *view once* (RVO), react & reply status
- **Tools** — HD foto, screenshot web, translate, TTS, cuaca, Pinterest, dsb.
- **Grup** — hidetag, pengaturan grup, info grup
- **Fun & Game** — AFK, khodam, menfess, math, tebak gambar
- **Islami** — doa harian, jadwal sholat, arti nama, zodiak, primbon
- **Story** — pasang & jadwalkan status WhatsApp
- **Jadibot** — clone bot untuk banyak nomor dalam satu proses
- **Tombol interaktif** — tombol reply / URL / salin kode / telepon / daftar pilihan (native flow)
- **Menu otomatis** — daftar command di menu mengikuti plugin yang terpasang
- **Sesi SQLite** — login sekali, sesi tersimpan sebagai satu file database

## 🧰 Teknologi

- [zapo-js-mod](https://www.npmjs.com/package/zapo-js-mod) 1.10.0-mod.2 — library WhatsApp Web (mod dari zapo-js 1.10)
- Node.js ≥ 20.9 (ES Modules)
- `@zapo-js/store-sqlite` + `better-sqlite3` — penyimpanan sesi

## 📦 Instalasi

```bash
git clone https://github.com/XLawXD0/kageno-sw
cd kageno-sw
npm install
```

Edit **`settings.js`** — isi nomor owner dan konfigurasi lain (lihat bagian
Konfigurasi), lalu jalankan:

```bash
node index.js
# atau dengan pm2:
pm2 start index.js --name botsw
```

### Login (pairing)

Saat pertama kali dijalankan, konsol akan menanyakan nomor WhatsApp yang
mau dijadikan bot. Masukkan nomornya (format `628xxxxxxxxxx`), lalu masukkan
kode pairing yang muncul di:

**WhatsApp → Perangkat Tertaut → Tautkan Perangkat → Tautkan dengan nomor telepon**

Mau melewati pertanyaan itu? Isi `BOT_NUMBER_PAIR` di `settings.js`.
Setelah terhubung, sesi tersimpan di `sessions/<nama>/state.sqlite` dan bot
tidak perlu pairing lagi pada start berikutnya.

> **Catatan:** format sesi zapo tidak kompatibel dengan sesi Baileys
> (`creds.json`). Bila pindah dari script berbasis Baileys, pairing ulang
> sekali memang wajib.

## ⚙️ Konfigurasi (`settings.js`)

Semua pengaturan ada di satu file `settings.js` (tidak memakai `.env`):

| Pengaturan | Keterangan |
| --- | --- |
| `BOT_SESSION_NAME` | Nama folder sesi bot utama |
| `BOT_NUMBER_OWNER` | Nomor WA owner, format `628xxxxxxxxxx` |
| `BOT_NUMBER_PAIR` | Nomor pairing otomatis; kosong = ditanya di konsol |
| `BOT_PREFIX` | Prefix command (bawaan `.`) |
| `BOT_LOGGER_LEVEL` | Level log: `silent` / `info` / `debug` |
| `BOT_REACT_STATUS` | React emoji ke status orang lain (`true`/`false`) |
| `BOT_SAVE_STATUS` | Simpan status yang lewat ke data lokal |
| `SCRLXRD_API_KEY` | API key layanan downloader (opsional) |
| `TELEGRAM_TOKEN` / `TELEGRAM_CHAT_ID` | Untuk fitur forward manual & stiker Telegram (opsional) |

Sebagian fitur downloader membutuhkan `yt-dlp` dan `ffmpeg` terpasang di
sistem.

## 🗂️ Struktur Folder

```
botsw/
├── index.js          # entry point
├── main.js           # koneksi bot utama, pairing, restore jadibot
├── settings.js       # SEMUA konfigurasi bot
├── handler/          # dispatcher pesan & event
├── helper/           # utilitas internal (jadibot, stiker, downloader, ...)
├── src/              # adapter zapo-js-mod & utilitas inti
└── plugins/          # semua command, dikelompokkan per kategori
    ├── downloader/
    ├── sticker/
    ├── status/
    ├── tools/
    ├── group/
    ├── info/
    ├── fun/
    ├── game/
    ├── islami/
    ├── story/
    ├── owner/
    └── dewasa/
```

## 🔌 Membuat Plugin

Simpan file di `plugins/<kategori>/` — plugin langsung terdaftar dan
otomatis muncul di menu:

```js
export default {
	name: 'halo',
	aliases: ['hai'],
	category: 'fun',
	desc: 'Sapa pengguna',
	async run(ctx) {
		const { m } = ctx;
		await m.reply('Halo juga! 👋');
	},
};
```

Tambahkan `hidden: true` bila command tidak ingin ditampilkan di menu.

## 🔘 Tombol Interaktif

Kirim pesan bertombol lewat `sendMessage` biasa:

```js
await hisoka.sendMessage(m.key.remoteJid, {
	text: 'Pilih salah satu:',
	footer: 'botsw',
	buttons: [
		{ type: 'reply', text: '📋 Menu', id: '.menu' },
		{ type: 'url', text: '🌐 Website', url: 'https://example.com' },
		{ type: 'copy', text: '📄 Salin Kode', code: 'PROMO10' },
		{ type: 'call', text: '📞 Telepon Owner', phone: '628xxxxxxxxxx' },
		{
			type: 'list', text: '⚡ Perintah Cepat', title: 'Pilih Perintah',
			sections: [{ title: 'Perintah', rows: [
				{ title: 'Menu Utama', description: 'Semua fitur', id: '.menu' },
				{ title: 'Ping', description: 'Cek respon bot', id: '.ping' },
			]}],
		},
	],
}, { quoted: m });
```

Tombol **reply** dan **list** yang diketuk akan menjalankan command sesuai
`id`-nya — jadi tombol di atas benar-benar membuka menu / ping saat diketuk.
Contoh lengkap ada di command `.tombol`.

## 📄 Lisensi

MIT — silakan dipakai dan dikembangkan. Kredit ke penulis asli sangat
dihargai.
