'use strict';

// Sistem game tebak-tebakan — port dari Furina MD.
// Data dari BochilTeam/database (GitHub) + file lokal.

import fs from 'fs';
import path from 'path';

const DATA_DIR = '/home/hatch/workspace/Kageno/data/games';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';

// Session aktif: { chatId: { game, data, timeout } }
const sessions = new Map();

const GAME_SOURCES = {
	tebakgambar: {
		url: 'https://raw.githubusercontent.com/BochilTeam/database/master/games/tebakgambar.json',
		type: 'image',
	},
	tebakkata: {
		url: 'https://raw.githubusercontent.com/BochilTeam/database/master/games/tebakkata.json',
		type: 'text',
	},
	tebakbendera: {
		url: 'https://raw.githubusercontent.com/BochilTeam/database/master/games/tebakbendera.json',
		type: 'image',
	},
	tebakbendera2: {
		url: 'https://raw.githubusercontent.com/BochilTeam/database/master/games/tebakbendera2.json',
		type: 'text',
	},
	susunkata: {
		url: 'https://raw.githubusercontent.com/BochilTeam/database/master/games/susunkata.json',
		type: 'text',
	},
	tekateki: {
		url: 'https://raw.githubusercontent.com/BochilTeam/database/master/games/tekateki.json',
		type: 'text',
	},
	asahotak: {
		url: 'https://raw.githubusercontent.com/BochilTeam/database/master/games/asahotak.json',
		type: 'text',
	},
	caklontong: {
		url: 'https://raw.githubusercontent.com/BochilTeam/database/master/games/caklontong.json',
		type: 'text',
	},
	family100: {
		url: 'https://raw.githubusercontent.com/BochilTeam/database/master/games/family100.json',
		type: 'text',
	},
	siapakahaku: {
		url: 'https://raw.githubusercontent.com/BochilTeam/database/master/games/siapakahaku.json',
		type: 'text',
	},
	tebakkimia: {
		url: 'https://raw.githubusercontent.com/BochilTeam/database/master/games/tebakkimia.json',
		type: 'text',
	},
	tebaklirik: {
		url: 'https://raw.githubusercontent.com/BochilTeam/database/master/games/tebaklirik.json',
		type: 'text',
	},
	tebakkalimat: {
		url: 'https://raw.githubusercontent.com/BochilTeam/database/master/games/tebakkalimat.json',
		type: 'text',
	},
};

const cache = new Map();

async function fetchGameData(game) {
	if (cache.has(game)) return cache.get(game);
	const src = GAME_SOURCES[game];
	if (!src) throw new Error('Game tidak dikenal.');
	const r = await fetch(src.url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(20000) });
	if (!r.ok) throw new Error('Gagal ambil soal.');
	const data = await r.json();
	cache.set(game, data);
	return data;
}

export function hasSession(chatId) {
	return sessions.has(chatId);
}

export function getSession(chatId) {
	return sessions.get(chatId) || null;
}

// Daftarkan sesi custom (untuk math)
export function _registerMath(chatId, jawaban, ms, onTimeout) {
	if (sessions.has(chatId)) throw new Error('Masih ada sesi game!');
	const timeout = setTimeout(() => {
		sessions.delete(chatId);
		onTimeout?.(jawaban);
	}, ms);
	sessions.set(chatId, { game: 'math', soal: { jawaban }, timeout });
}

export function clearSession(chatId) {
	const s = sessions.get(chatId);
	if (s?.timeout) clearTimeout(s.timeout);
	sessions.delete(chatId);
}

export async function startGame(chatId, game, onTimeout) {
	if (sessions.has(chatId)) throw new Error('Masih ada sesi game yang belum selesai!');
	const data = await fetchGameData(game);
	const soal = data[Math.floor(Math.random() * data.length)];
	const src = GAME_SOURCES[game];

	const session = { game, soal, type: src.type };
	const timeout = setTimeout(() => {
		sessions.delete(chatId);
		onTimeout?.(soal);
	}, 60000);
	session.timeout = timeout;
	sessions.set(chatId, session);
	return { soal, type: src.type };
}

export function checkAnswer(chatId, text) {
	const s = sessions.get(chatId);
	if (!s) return null;
	const jawaban = (s.soal.jawaban || '').toLowerCase().trim();
	const guess = (text || '').toLowerCase().trim();
	if (!guess || !jawaban) return null;
	if (guess === jawaban) {
		clearSession(chatId);
		return { correct: true, jawaban: s.soal.jawaban };
	}
	return { correct: false };
}

export function formatQuestion(game, soal) {
	const titles = {
		tebakgambar: '🖼️ *TEBAK GAMBAR*',
		tebakkata: '🔤 *TEBAK KATA*',
		tebakbendera: '🏳️ *TEBAK BENDERA*',
		tebakbendera2: '🏳️ *TEBAK BENDERA 2*',
		susunkata: '🔀 *SUSUN KATA*',
		tekateki: '🧩 *TEKA-TEKI*',
		asahotak: '🧠 *ASAH OTAK*',
		caklontong: '😂 *CAK LONTONG*',
		family100: '👨‍👩‍👧 *FAMILY 100*',
		siapakahaku: '❓ *SIAPAKAH AKU*',
		tebakkimia: '⚗️ *TEBAK KIMIA*',
		tebaklirik: '🎵 *TEBAK LIRIK*',
		tebakkalimat: '📝 *TEBAK KALIMAT*',
	};
	let t = `${titles[game] || game}\n\n`;
	if (soal.deskripsi) t += `📝 ${soal.deskripsi}\n`;
	if (soal.soal) t += `❓ ${soal.soal}\n`;
	if (soal.pertanyaan) t += `❓ ${soal.pertanyaan}\n`;
	if (soal.clue) t += `💡 Clue: ${soal.clue}\n`;
	t += `\n⏱️ 60 detik | Ketik jawaban langsung`;
	return t;
}

export const GAME_LIST = Object.keys(GAME_SOURCES);
