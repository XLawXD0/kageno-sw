'use strict';

// Fitur Islami — port dari Furina MD.
// jadwalsholat via Aladhan API (gratis), doaharian dari data lokal.

import fs from 'fs';
import path from 'path';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';
const DOA_JSON = '/home/hatch/workspace/Kageno/data/doaharian.json';

export async function getJadwalSholat(kota = 'Jakarta') {
	const r = await fetch(
		`https://api.aladhan.com/v1/timingsByCity?city=${encodeURIComponent(kota)}&country=Indonesia&method=11`,
		{ headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(20000) }
	);
	if (!r.ok) throw new Error('API jadwal sholat sibuk.');
	const j = await r.json();
	if (!j.data) throw new Error(`Kota "${kota}" tidak ditemukan.`);
	const t = j.data.timings;
	const hijri = j.data.date.hijri;
	return {
		kota,
		imsak: t.Imsak, subuh: t.Fajr, terbit: t.Sunrise,
		dzuhur: t.Dhuhr, ashar: t.Asr, maghrib: t.Maghrib, isya: t.Isha,
		hijriyah: `${hijri.day} ${hijri.month.en} ${hijri.year} H`,
	};
}

export function formatJadwal(j) {
	return `🕌 *Jadwal Sholat — ${j.kota}*\n📅 ${j.hijriyah}\n\n` +
		`⏰ Imsak: ${j.imsak}\n` +
		`🌅 Subuh: ${j.subuh}\n` +
		`☀️ Terbit: ${j.terbit}\n` +
		`☀️ Dzuhur: ${j.dzuhur}\n` +
		`🌤️ Ashar: ${j.ashar}\n` +
		`🌆 Maghrib: ${j.maghrib}\n` +
		`🌙 Isya: ${j.isya}`;
}

function loadDoa() {
	try {
		return JSON.parse(fs.readFileSync(DOA_JSON, 'utf8'));
	} catch { return []; }
}

export function getDoaHarian(index = null) {
	const all = loadDoa();
	if (!all.length) throw new Error('Data doa tidak tersedia.');
	if (index !== null && all[index]) return { doa: all[index], index };
	const i = Math.floor(Math.random() * all.length);
	return { doa: all[i], index: i };
}

export function formatDoa(d, index, total) {
	return `🤲 *${d.title}* (${index + 1}/${total})\n\n` +
		`${d.arabic}\n\n` +
		`_${d.latin}_\n\n` +
		`Artinya: ${d.translation}`;
}

export function getDoaCount() {
	return loadDoa().length;
}
