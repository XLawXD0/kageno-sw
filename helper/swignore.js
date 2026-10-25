'use strict';

import fs from 'fs';
import path from 'path';
import { rootPath } from './paths.js';

const cleanNum = n => String(n).replace(/[^0-9]/g, '');

export function loadSwIgnore(hisoka) {
	const file = rootPath(hisoka, 'swignore.json');
	try {
		const raw = JSON.parse(fs.readFileSync(file, 'utf-8') || '{}');
		if (Array.isArray(raw)) {
			return { read: raw, react: raw };
		}
		return {
			read: Array.isArray(raw.read) ? raw.read : [],
			react: Array.isArray(raw.react) ? raw.react : [],
		};
	} catch {
		return { read: [], react: [] };
	}
}

export function saveSwIgnore(hisoka, data) {
	const file = rootPath(hisoka, 'swignore.json');
	try {
		fs.mkdirSync(path.dirname(file), { recursive: true });
		fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
	} catch {}
}

export function isSwReadIgnored(senderJidOrNum, hisoka) {
	if (!senderJidOrNum) return false;
	const { read } = loadSwIgnore(hisoka);
	if (!read.length) return false;
	const num = cleanNum(senderJidOrNum);
	const jid = String(senderJidOrNum).toLowerCase();
	return read.some(item => {
		const cleanItem = cleanNum(item);
		return (cleanItem && cleanItem === num) || jid.includes(String(item).toLowerCase()) || String(item).toLowerCase() === jid;
	});
}

export function isSwReactIgnored(senderJidOrNum, hisoka) {
	if (!senderJidOrNum) return false;
	const { react } = loadSwIgnore(hisoka);
	if (!react.length) return false;
	const num = cleanNum(senderJidOrNum);
	const jid = String(senderJidOrNum).toLowerCase();
	return react.some(item => {
		const cleanItem = cleanNum(item);
		return (cleanItem && cleanItem === num) || jid.includes(String(item).toLowerCase()) || String(item).toLowerCase() === jid;
	});
}
