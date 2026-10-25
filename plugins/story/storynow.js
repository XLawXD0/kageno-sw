'use strict';
// Command: storynow (per-instance)

import * as shared from '../_shared.js';
const { fs, loadStoryCfg, saveStoryCfg, downloadTikTokHD, postToStatus } = shared;

export default {
	name: 'storynow',
	aliases: [],
	category: 'other',
	desc: 'Posting story sekarang (dari antrian)',
	async run(ctx) {
		const { hisoka, m } = ctx;
		const cfg = loadStoryCfg(hisoka);
		if (!cfg.queue.length) { await m.reply('Antrian kosong. Tambah dulu: .storyadd <link tiktok>'); return; }
		const item = cfg.queue[cfg.index % cfg.queue.length];
		const { startLoading: slStory } = await import('../../helper/loading.js');
		const storyLoad = await slStory(hisoka, m, 'Posting story');
		try {
			const dl = await downloadTikTokHD(item.url, hisoka);
			const caption = cfg.caption || `🎬 ${dl.title}\n👤 @${dl.uploader}`;
			await postToStatus(hisoka, dl.file, caption);
			cfg.index = (cfg.index + 1) % cfg.queue.length;
			saveStoryCfg(cfg, hisoka);
			await storyLoad.done('✅ Story terkirim!');
			try { fs.unlinkSync(dl.file); } catch {}
		} catch (e) {
			await storyLoad.fail('❌ Gagal: ' + (e?.message || e));
		}
	},
};
