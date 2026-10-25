'use strict';
// ============================================================
// settings.js — Konfigurasi bot (pengganti file .env)
// Isi nilai-nilai di bawah ini, lalu jalankan bot:
//   npm install
//   node index.js
// ============================================================

const settings = {
	// ---------------- Bot utama ----------------
	BOT_SESSION_NAME: 'botsw', // nama folder sesi bot utama (sessions/<nama>)
	BOT_NUMBER_OWNER: '', // nomor WA owner, format 628xxxxxxxxxx
	BOT_OWNER_NAME: '', // nama owner (ditampilkan di beberapa pesan)
	BOT_NUMBER_PAIR: '', // nomor untuk pairing bot utama; kosong = ditanya di konsol saat start
	BOT_PREFIX: '.', // prefix command
	BOT_MAX_RETRIES: '', // batas reconnect bot utama; kosong = tanpa batas
	BOT_MENU_STYLE: '', // gaya menu (opsional)
	BOT_LOGGER_LEVEL: 'silent', // level log: silent | info | debug
	BOT_ALLOWED_NO_PREFIX: '', // 'true' bila command tanpa prefix diizinkan

	// ---------------- Perilaku bot ----------------
	DEBUG_RVO: 'false', // log debug fitur view-once
	BOT_REACT_STATUS: 'true', // react emoji ke status (SW) orang lain
	BOT_SAVE_STATUS: 'false', // simpan status yang lewat ke data lokal
	BOT_AUTODL_MEDIA: 'false', // unduh media otomatis
	BOT_LOG_MESSAGE: 'false', // log semua pesan masuk ke konsol

	// ---------------- Telegram (fitur user-facing) ----------------
	// Dipakai fitur yang TERLIHAT pengguna: forward manual (.fwd),
	// ambil stiker Telegram, dan ringkasan harian bot utama.
	TELEGRAM_TOKEN: '', // token bot Telegram kamu
	TELEGRAM_CHAT_ID: '', // chat/grup tujuan forward manual
	TELEGRAM_OWNER_ID: '', // ID Telegram owner (ringkasan harian)

	// ---------------- API key layanan ----------------
	SCRLXRD_API_KEY: '', // API key restapi ScrLxrd
	SCRLXRD_API_BASE: '', // base URL restapi (opsional)
	TIKTOK_V2_API: '', // endpoint TikTok v2 (opsional)
	TIKTOK_V2_API_KEY: '', // API key TikTok v2 (opsional)
	NEOXR_APIKEY: '', // API key Neoxr (opsional)
	IYANAPI_KEY: '', // API key Iyan API (opsional)
	YTDLP_PATH: '', // path yt-dlp (opsional; kosong = cari di PATH)
};

// Jembatan konfigurasi: salin nilai settings ke process.env agar
// seluruh kode bot membacanya seperti biasa. Variabel environment
// asli (bila diset di sistem/pm2) tetap lebih diutamakan.
for (const [key, value] of Object.entries(settings)) {
	if (value !== '' && value !== undefined && value !== null && process.env[key] === undefined) {
		process.env[key] = String(value);
	}
}

export default settings;
