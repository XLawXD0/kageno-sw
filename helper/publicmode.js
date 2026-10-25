'use strict';

// Mode publik / self per instance (bot utama vs per jadibot) dengan rate limiting.
import fs from 'fs';
import path from 'path';
import { rootPath } from './paths.js';

// { [instanceKey_senderJid]: [timestamp, ...] }
const usage = new Map();

function getConfigPath(hisoka) {
	return rootPath(hisoka, 'publicmode.json');
}

export function loadConfig(hisoka) {
	try {
		const f = getConfigPath(hisoka);
		const raw = fs.readFileSync(f, 'utf-8');
		const d = JSON.parse(raw || '{}');
		return {
			enabled: d.enabled === true,
			whitelist: Array.isArray(d.whitelist) ? d.whitelist : ['menu', 'ping', 'help', 'sticker', 's'],
			ratelimit_per_hour: typeof d.ratelimit_per_hour === 'number' ? d.ratelimit_per_hour : 10,
			welcome_message: d.welcome_message !== false,
		};
	} catch {
		return { enabled: false, whitelist: ['menu', 'ping', 'help', 'sticker', 's'], ratelimit_per_hour: 10, welcome_message: true };
	}
}

export function saveConfig(hisoka, nextCfg) {
	const f = getConfigPath(hisoka);
	const cur = loadConfig(hisoka);
	const merged = { ...cur, ...nextCfg };
	try {
		fs.mkdirSync(path.dirname(f), { recursive: true });
		fs.writeFileSync(f, JSON.stringify(merged, null, 2) + '\n');
	} catch {}
	return merged;
}

export function isPublicModeEnabled(hisoka) {
	return loadConfig(hisoka).enabled === true;
}

export function isPublicCommand(hisoka, cmd) {
	if (!cmd) return false;
	const cfg = loadConfig(hisoka);
	const list = (cfg.whitelist || []).map(c => String(c).toLowerCase());
	return list.includes(String(cmd).toLowerCase());
}

export function getPublicWelcome(hisoka) {
	const cfg = loadConfig(hisoka);
	if (!cfg.welcome_message) return null;
	const cmds = (cfg.whitelist || []).join(', ');
	return `🤖 *Halo! Bot ini dalam mode publik.*\n\nCommand yang bisa dipakai:\n${cmds}\n\nKetik command dengan awalan . atau / ya!`;
}

/**
 * Cek rate limit. Return { allowed: bool, remaining: number, resetIn: string }
 */
export function checkRateLimit(hisoka, senderJid) {
	const cfg = loadConfig(hisoka);
	const limit = cfg.ratelimit_per_hour || 10;
	const now = Date.now();
	const hourAgo = now - 3600 * 1000;

	const key = `${rootPath(hisoka, '')}_${senderJid}`;
	let times = usage.get(key) || [];
	times = times.filter(t => t > hourAgo);

	if (times.length >= limit) {
		const oldest = Math.min(...times);
		const resetMs = oldest + 3600 * 1000 - now;
		const resetMin = Math.ceil(resetMs / 60000);
		return { allowed: false, remaining: 0, resetIn: `${resetMin} menit` };
	}

	times.push(now);
	usage.set(key, times);
	return { allowed: true, remaining: limit - times.length, resetIn: null };
}

// Bersihkan memory tiap jam (hindari memory leak)
setInterval(() => {
	const hourAgo = Date.now() - 3600 * 1000;
	for (const [key, times] of usage) {
		const fresh = times.filter(t => t > hourAgo);
		if (fresh.length) usage.set(key, fresh);
		else usage.delete(key);
	}
}, 3600 * 1000).unref?.();
