'use strict';

// Animasi loading keren: kirim 1 pesan lalu edit berulang dengan spinner.
// Pakai: const load = await startLoading(hisoka, m, 'Download');
//        ... kerja berat ...
//        await load.done('✅ Selesai!');   // atau load.fail('❌ Gagal')

const FRAMES = [
	'[█░░░░░░░░░] 10%',
	'[██░░░░░░░░] 20%',
	'[███░░░░░░░] 30%',
	'[████░░░░░░] 40%',
	'[█████░░░░░] 50%',
	'[██████░░░░] 60%',
	'[███████░░░] 70%',
	'[████████░░] 80%',
	'[█████████░] 90%',
	'[██████████] 100%',
];
const INTERVAL_MS = 800;
const MAX_MS = 120000; // pengaman: berhenti otomatis setelah 2 menit

export async function startLoading(hisoka, m, label = 'Loading') {
	let sent = null;
	try {
		sent = await m.reply(`*${label}...*\n${FRAMES[0]}`);
	} catch {
		return nullLoader();
	}
	const key = sent?.key;
	if (!key) return nullLoader();
	let i = 0;
	const started = Date.now();
	const timer = setInterval(async () => {
		try {
			if (Date.now() - started > MAX_MS) { clearInterval(timer); return; }
			i = (i + 1) % FRAMES.length;
			await hisoka.sendMessage(m.from, { text: `*${label}...*\n${FRAMES[i]}`, edit: key });
		} catch {
			clearInterval(timer);
		}
	}, INTERVAL_MS);

	const finish = async (finalText, del = false) => {
		clearInterval(timer);
		try {
			if (del) {
				await hisoka.sendMessage(m.from, { delete: key });
			} else if (finalText) {
				// Tampilkan 100% sekilas biar puas, baru ganti ke hasil akhir
				try {
					await hisoka.sendMessage(m.from, { text: `*${label}...*\n[██████████] 100%`, edit: key });
					await new Promise(r => setTimeout(r, 600));
				} catch {}
				await hisoka.sendMessage(m.from, { text: finalText, edit: key });
			}
		} catch { /* abaikan */ }
	};
	return {
		done: (t) => finish(t || `✅ *${label} selesai!*`),
		fail: (t) => finish(t || `❌ *${label} gagal.*`),
		stop: () => finish(null, true), // hapus pesan loading
	};
}

function nullLoader() {
	const noop = async () => {};
	return { done: noop, fail: noop, stop: noop };
}
