'use strict';

import fs from 'fs';
import path from 'path';
import { rootPath, isCloneCtx } from './paths.js';

const DEFAULTS = {
	autoread: true,
	autoreact: true,
	random_emoji: false,
	emoji_pool: ['❤️', '😍', '🔥', '👍', '😮', '🥰', '💯', '👏', '😎', '🎉'],
	autoreply: false,
	reply_text: 'hai',
	react_text: '',
	uptimebio: false,
};

function getConfigFile(hisoka) {
	return rootPath(hisoka, 'swconfig.json');
}

function getReactFile(hisoka) {
	return rootPath(hisoka, 'react.json');
}

export function readSwConfig(hisoka = null) {
	const configFile = getConfigFile(hisoka);
	let file = null;
	try { file = JSON.parse(fs.readFileSync(configFile, 'utf-8') || '{}'); } catch { file = null; }
	const cfg = { ...DEFAULTS, ...(file || {}) };
	if (!Array.isArray(cfg.emoji_pool)) cfg.emoji_pool = [...DEFAULTS.emoji_pool];
	cfg.autoread = cfg.autoread !== false;
	cfg.autoreact = cfg.autoreact !== false;
	cfg.random_emoji = cfg.random_emoji === true;
	cfg.autoreply = cfg.autoreply === true;
	if (typeof cfg.reply_text !== 'string' || !cfg.reply_text.trim()) cfg.reply_text = 'hai';
	if (typeof cfg.react_text !== 'string') cfg.react_text = '';
	cfg.uptimebio = cfg.uptimebio === true;
	if (!file) {
		try { fs.writeFileSync(configFile, JSON.stringify(cfg, null, 2) + '\n'); } catch {}
	}
	return cfg;
}

export function writeSwConfig(patch, hisoka = null) {
	const cfg = readSwConfig(hisoka);
	const next = { ...cfg, ...patch };
	fs.writeFileSync(getConfigFile(hisoka), JSON.stringify(next, null, 2) + '\n');
	return next;
}

export function pickEmoji(senderNum, cfg, hisoka = null) {
	const pool = (cfg.emoji_pool || []).filter(Boolean);
	if (cfg.random_emoji) {
		if (!pool.length) return fallbackEnvEmoji();
		return pool[Math.floor(Math.random() * pool.length)];
	}
	try {
		const reactCfg = JSON.parse(fs.readFileSync(getReactFile(hisoka), 'utf-8') || '{}');
		const custom = reactCfg[senderNum] || reactCfg.default || '';
		if (custom) return custom;
	} catch {}
	if (pool.length) return pool[Math.floor(Math.random() * pool.length)];
	return fallbackEnvEmoji();
}

function fallbackEnvEmoji() {
	const list = (process.env.BOT_REACT_STATUS || '').split(',').map(s => s.trim()).filter(Boolean);
	if (!list.length) return '';
	return list[Math.floor(Math.random() * list.length)];
}

export function extractEmojis(text) {
	const found = (text || '').match(/\p{Extended_Pictographic}/gu) || [];
	return [...new Set(found)];
}
