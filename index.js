'use strict';

// ============================================================
// index.js — Entry point bot WhatsApp (zapo-js-mod).
// Jalankan: node index.js   (atau npm start / ./run.sh)
// ============================================================

import './settings.js';

// Jangan biarkan satu error membunuh seluruh bot.
process.on('uncaughtException', err => {
	console.error('\x1b[31m[guard] uncaughtException:\x1b[39m', err?.message || err);
});
process.on('unhandledRejection', reason => {
	console.error('\x1b[31m[guard] unhandledRejection:\x1b[39m', reason?.message || reason);
});

// Validate BOT_MAX_RETRIES
if (process.env.BOT_MAX_RETRIES && isNaN(Number(process.env.BOT_MAX_RETRIES))) {
	console.warn('\x1b[33mWarning: BOT_MAX_RETRIES is not a valid number. Disabling max retry limit.\x1b[39m');
	delete process.env.BOT_MAX_RETRIES;
}

// ============================================================
// Perbaikan mandiri binding better-sqlite3 (mesin SQLite zapo).
// Di sebagian panel, `npm install` tidak menjalankan skrip unduh/bangun
// biner native-nya -> file .node hilang -> store gagal -> klien tidak
// pernah tersambung ("client is not connected" saat pairing).
// Deteksi lewat proses anak (cache modul proses utama tidak tercemar),
// lalu perbaiki SEBELUM main.js dimuat.
// ============================================================
{
	const { execFile } = await import('node:child_process');
	const path = await import('node:path');
	const run = (cmd, args, cwd, timeout = 180000) => new Promise(res => {
		const p = execFile(cmd, args, { cwd, timeout }, err => res(!err));
		p.stdout?.on('data', d => process.stdout.write(`[sqlite] ${d}`));
		p.stderr?.on('data', d => process.stderr.write(`[sqlite] ${d}`));
	});
	// Wajib benar-benar membuka database: require() saja tidak memuat binding.
	const bsOk = () => run(process.execPath, ['-e', 'try{const D=require("better-sqlite3");const d=new D(":memory:");d.close();process.exit(0)}catch{process.exit(1)}'], process.cwd(), 30000);
	if (!(await bsOk())) {
		console.log('[sqlite] binding better-sqlite3 belum terpasang — memasang sekarang...');
		const bsDir = path.join(process.cwd(), 'node_modules', 'better-sqlite3');
		await run('npx', ['--yes', 'prebuild-install'], bsDir);
		if (!(await bsOk())) {
			console.log('[sqlite] unduh prebuild gagal — mencoba build dari sumber...');
			await run('npm', ['rebuild', 'better-sqlite3'], process.cwd());
		}
		if (await bsOk()) console.log('[sqlite] binding better-sqlite3 OK.');
		else console.error('[sqlite] GAGAL memasang binding. Jalankan manual di Shell panel: npm rebuild better-sqlite3');
	}
}

const { boot } = await import('./main.js');

boot().catch(err => {
	console.error('\x1b[31mAn error occurred:\x1b[39m');
	console.error(err);
});
