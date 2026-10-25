'use strict';
// Konversi buffer gambar/video menjadi stiker WebP via ffmpeg.

import { execFile } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import os from 'os';

const execFileAsync = promisify(execFile);
const FFMPEG = fs.existsSync('/usr/bin/ffmpeg') ? '/usr/bin/ffmpeg' : 'ffmpeg';

/**
 * @param {Buffer} buffer gambar/video
 * @returns {Promise<Buffer>} webp sticker
 */
export async function bufferToSticker(buffer) {
	if (!buffer || !buffer.length) throw new Error('Buffer kosong');
	const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'st-'));
	const input = path.join(tmpDir, 'input');
	const output = path.join(tmpDir, 'sticker.webp');
	fs.writeFileSync(input, buffer);
	try {
		await execFileAsync(FFMPEG, [
			'-y',
			'-i', input,
			'-vf', 'scale=512:512:force_original_aspect_ratio=decrease,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=0x00000000',
			'-vcodec', 'libwebp',
			'-qscale', '75',
			'-preset', 'default',
			'-loop', '0',
			'-an',
			'-vsync', '0',
			output,
		], { timeout: 120000 });
		return fs.readFileSync(output);
	} finally {
		fs.rmSync(tmpDir, { recursive: true, force: true });
	}
}
