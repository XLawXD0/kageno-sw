'use strict';

const settings = {
	// ---------------- WAJIB DIISI ----------------
	BOT_NUMBER_OWNER: '', // nomor WA owner, format 628xxxxxxxxxx
	SCRLXRD_API_KEY: '', // API key restapi ScrLxrd (untuk fitur downloader/restapi)

	// ---------------- Bot utama ----------------
	BOT_SESSION_NAME: 'botsw', // nama folder sesi bot utama (sessions/<nama>)
	BOT_NUMBER_PAIR: '', // nomor pairing bot utama; kosong = ditanya di konsol saat start
	BOT_PREFIX: '.', // prefix command
	BOT_LOGGER_LEVEL: 'silent', // level log: silent | info | debug

	// ---------------- Perilaku (nilai bawaan dipertahankan) ----------------
	BOT_REACT_STATUS: 'true', // react emoji ke status (SW) orang lain
	BOT_SAVE_STATUS: 'false', // simpan status yang lewat ke data lokal

	// ---------------- Telegram (opsional) ----------------
	TELEGRAM_TOKEN: '', // token bot Telegram (forward manual & stiker Telegram)
	TELEGRAM_CHAT_ID: '', // chat/grup tujuan forward manual
};

for (const [key, value] of Object.entries(settings)) {
	if (value !== '' && value !== undefined && value !== null && process.env[key] === undefined) {
		process.env[key] = String(value);
	}
}

export default settings;
