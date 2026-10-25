import { toCapitalize } from './text.js';

/**
 * @param {string} chatId
 * @param {Buffer | string} media
 * @param {Object} options
 * @param {string} [options.parse_mode]
 * @param {string} [options.caption]
 * @param {string} [options.token] override token (untuk jadibot)
 * @param {'text'|'photo'|'video'|'audio'|'document'|'sticker'|'voice'} [options.type]
 */
export async function send(chatId, media = '', options = {}) {
	const token = options.token || process.env.TELEGRAM_TOKEN;
	if (!token) throw new Error('Telegram token belum diset.');
	if (!chatId) throw new Error('Telegram chat ID belum diset.');

	const type = (options.type || 'text').replace('image', 'photo').replace('audio', 'voice');

	const DEFAULT_EXTENSIONS = {
		audio: ['audio/mp3', 'mp3'],
		photo: ['image/jpeg', 'jpg'],
		sticker: ['image/webp', 'webp'],
		video: ['video/mp4', 'mp4'],
		document: ['application/pdf', 'pdf'],
		voice: ['audio/ogg', 'ogg'],
		text: ['text/plain', 'txt'],
	};

	const ext = DEFAULT_EXTENSIONS[type];
	if (!ext) throw new Error(`Unsupported media type: ${options.type}`);

	const url = `https://api.telegram.org/bot${token}/send${type === 'text' ? 'Message' : toCapitalize(type)}`;
	const form = new FormData();

	form.append('chat_id', chatId);
	if (options.parse_mode) form.append('parse_mode', options.parse_mode);
	if (type === 'text') form.append(type, media || options.caption || '');
	else {
		if (Buffer.isBuffer(media)) {
			form.append(type, new Blob([media], { type: ext[0] }), `file.${ext[1]}`);
		} else {
			throw new Error('Invalid media input: must be a Buffer');
		}
		if (options.caption) form.append('caption', options.caption);
	}

	const res = await fetch(url, {
		method: 'POST',
		body: form,
		headers: { Accept: 'application/json' },
	});
	return res.json();
}
