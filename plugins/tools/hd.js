'use strict';
// Command: hd — upscale gambar jadi HD via ScrLxrd REST API.
// 3 cara pakai:
//   1. .hd <url-gambar> [2|4]        -> upscale langsung dari URL
//   2. reply gambar dengan .hd       -> gambar diupload dulu ke /api/tools/upload
//   3. kirim gambar + caption .hd    -> sama seperti reply

import { apiMediaBuffer, apiUploadBuffer, getApiKey } from '../../helper/scrlxrd-api.js';

/** Tebak ekstensi dari magic bytes (jpg/png/webp/gif). */
function detectExt(buf) {
	if (!buf || buf.length < 4) return 'jpg';
	if (buf[0] === 0xFF && buf[1] === 0xD8) return 'jpg';
	if (buf[0] === 0x89 && buf[1] === 0x50) return 'png';
	if (buf[0] === 0x52 && buf[1] === 0x49) return 'webp'; // RIFF
	if (buf[0] === 0x47 && buf[1] === 0x49) return 'gif';
	return 'jpg';
}

const MAX_MEDIA_MB = 15;

export default {
	name: 'hd',
	aliases: ['upscale', 'hdimage'],
	category: 'tools',
	desc: 'Ubah gambar jadi HD (upscale AI)\n\nReply gambar / kirim gambar + caption `.hd`, atau:\n`.hd https://contoh.com/gambar.jpg`\nSkala 2x/4x (default 4x): `.hd <url> 2`',
	async run(ctx) {
		const { hisoka, m, query } = ctx;
		const args = (query || '').trim().split(/\s+/).filter(Boolean);
		const urlArg = args.find(a => /^https?:\/\//i.test(a));
		const scaleArg = args.find(a => /^(2|4)$/.test(a));
		const scale = scaleArg ? parseInt(scaleArg, 10) : 4;

		if (!getApiKey()) {
			await m.reply('❌ SCRLXRD_API_KEY belum diset di .env');
			return;
		}

		let imageUrl = urlArg || null;
		let mediaBuf = null;

		// Gambar dikirim langsung dengan caption .hd
		if (!imageUrl && m.isMedia && m.type === 'imageMessage') {
			try { mediaBuf = await m.downloadMedia(); }
			catch { await m.reply('❌ Gagal mengunduh gambar.'); return; }
		}
		// Gambar dari reply
		if (!imageUrl && !mediaBuf && m.isQuoted && m.quoted?.isMedia && m.quoted.type === 'imageMessage') {
			try { mediaBuf = await m.quoted.downloadMedia(); }
			catch { await m.reply('❌ Gagal mengunduh gambar yang di-reply.'); return; }
		}

		if (!imageUrl && !mediaBuf) {
			await m.reply(
				'Kirim gambar dengan caption `.hd`, reply gambar dengan `.hd`, atau:\n' +
				'`.hd https://contoh.com/gambar.jpg`\n\n' +
				'Skala opsional 2x/4x (default 4x): `.hd <url> 2`'
			);
			return;
		}
		if (mediaBuf && mediaBuf.length > MAX_MEDIA_MB * 1024 * 1024) {
			await m.reply(`❌ Gambar terlalu besar (maks ${MAX_MEDIA_MB}MB).`);
			return;
		}

		const { startLoading } = await import('../../helper/loading.js');
		const load = await startLoading(hisoka, m, mediaBuf ? 'Upload & upscale gambar' : `Upscale gambar (${scale}x)`);
		try {
			// Gambar dari WA diupload dulu ke CDN API, lalu URL-nya di-upscale.
			if (mediaBuf) {
				const ext = detectExt(mediaBuf);
				imageUrl = await apiUploadBuffer('/api/tools/upload', mediaBuf, `hd-${Date.now()}.${ext}`);
			}
			const img = await apiMediaBuffer('/api/ai/upscale', { url: imageUrl, scale }, 30);
			await load.stop();
			await hisoka.sendMessage(m.from, {
				image: img,
				caption: `✨ *HD Image* (${scale}x upscale)`,
			}, { quoted: m });
		} catch (e) {
			const msg = e?.message || 'Gagal upscale gambar.';
			const hint = /whitelist/i.test(msg)
				? '\n\n💡 IP server bot belum di-whitelist di API. Tambahkan IP di halaman Profile api.scrlxrd.pp.ua ya.'
				: '';
			try { await load.fail('❌ ' + msg + hint); }
			catch { await m.reply('❌ ' + msg + hint); }
		}
	},
};
