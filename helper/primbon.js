'use strict';

// Primbon (ramalan Jawa) — port dari Furina MD via scrape-primbon.

import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { Primbon } = require('scrape-primbon');
const primbon = new Primbon();

export async function artiNama(nama) {
	const r = await primbon.arti_nama(nama);
	if (r.status === false) throw new Error(r.message);
	return r.message;
}

export async function ramalanJodoh(nama1, nama2) {
	const r = await primbon.kecocokan_nama_pasangan(nama1, nama2);
	if (r.status === false) throw new Error(r.message);
	return r.message;
}

export function getZodiak(tgl, bln) {
	const z = [
		['capricorn', new Date(1970, 0, 1)],
		['aquarius', new Date(1970, 0, 20)],
		['pisces', new Date(1970, 1, 19)],
		['aries', new Date(1970, 2, 21)],
		['taurus', new Date(1970, 3, 21)],
		['gemini', new Date(1970, 4, 21)],
		['cancer', new Date(1970, 5, 22)],
		['leo', new Date(1970, 6, 23)],
		['virgo', new Date(1970, 7, 23)],
		['libra', new Date(1970, 8, 23)],
		['scorpio', new Date(1970, 9, 23)],
		['sagittarius', new Date(1970, 10, 22)],
		['capricorn', new Date(1970, 11, 22)],
	].reverse();
	const d = new Date(1970, bln - 1, tgl);
	return z.find(([_, _d]) => d >= _d)[0];
}

export async function zodiakInfo(nama) {
	const r = await primbon.zodiak(nama);
	if (r.status === false) throw new Error(r.message);
	return r.message;
}
