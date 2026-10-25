/**
 * CosplayTele scraper — cosplaytele.com (WordPress).
 * Search post, ambil foto-foto langsung (direct webp), kirim sebagai album.
 * Video di-embed via cossora.stream (tidak bisa di-resolve) -> hanya foto.
 */

const BASE = 'https://cosplaytele.com';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

async function fetchHtml(url) {
	const res = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(25000) });
	if (!res.ok) throw new Error(`HTTP ${res.status}`);
	return res.text();
}

function decodeEntities(s) {
	return s
		.replace(/&#8211;/g, '–').replace(/&#8220;/g, '"').replace(/&#8221;/g, '"')
		.replace(/&#8217;/g, "'").replace(/&amp;/g, '&').replace(/&quot;/g, '"')
		.replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n));
}

/**
 * Cari postingan. Return [{ title, url }]
 */
export async function searchCosplay(keyword, limit = 10) {
	const html = await fetchHtml(`${BASE}/?s=${encodeURIComponent(keyword)}`);
	const out = [];
	const re = /<a\s+href="(https:\/\/cosplaytele\.com\/[^"]+\/)"\s+class="plain">([^<]+)<\/a>/g;
	let m;
	while ((m = re.exec(html)) && out.length < limit) {
		const url = m[1];
		// skip halaman statis / kategori
		if (/\/(24-hours|3-day|7-day|best-cosplayer|big-breast)\/$/.test(url)) continue;
		out.push({ title: decodeEntities(m[2]).trim(), url });
	}
	// dedup by url
	const seen = new Set();
	return out.filter(r => (seen.has(r.url) ? false : (seen.add(r.url), true)));
}

/**
 * Ambil URL foto-foto konten dari halaman postingan.
 */
export async function getPostPhotos(postUrl, limit = 10) {
	const html = await fetchHtml(postUrl);
	const out = [];
	const re = /<img[^>]+src="(https:\/\/cosplaytele\.com\/wp-content\/uploads\/[^"]+)"/g;
	let m;
	while ((m = re.exec(html)) && out.length < limit) {
		const src = m[1];
		// skip logo & banner situs
		if (/293172358_1027749337945791/.test(src)) continue;
		if (out.includes(src)) continue;
		out.push(src);
	}
	return out;
}

/**
 * Ambil daftar postingan terbaru dari homepage (untuk .cosplay random).
 */
export async function getLatestPosts(limit = 20) {
	const html = await fetchHtml(`${BASE}/`);
	const out = [];
	const re = /<a\s+href="(https:\/\/cosplaytele\.com\/[^"]+\/)"\s+class="plain">([^<]+)<\/a>/g;
	let m;
	const seen = new Set();
	while ((m = re.exec(html)) && out.length < limit) {
		const url = m[1];
		if (seen.has(url)) continue;
		seen.add(url);
		out.push({ title: decodeEntities(m[2]).trim(), url });
	}
	return out;
}

/**
 * Download beberapa URL gambar ke folder tmp. Return path file yang berhasil.
 */
export async function downloadPhotos(urls, dir, maxBytes = 15 * 1024 * 1024) {
	const fs = await import('fs');
	const path = await import('path');
	fs.mkdirSync(dir, { recursive: true });
	const files = [];
	let i = 0;
	for (const u of urls) {
		try {
			const res = await fetch(u, { headers: { 'User-Agent': UA, Referer: BASE + '/' }, signal: AbortSignal.timeout(30000) });
			if (!res.ok) continue;
			const buf = Buffer.from(await res.arrayBuffer());
			if (!buf.length || buf.length > maxBytes) continue;
			const ext = u.includes('.webp') ? 'webp' : u.includes('.png') ? 'png' : 'jpg';
			const fp = path.join(dir, `cosplay_${Date.now()}_${i++}.${ext}`);
			fs.writeFileSync(fp, buf);
			files.push(fp);
		} catch { /* skip gagal */ }
	}
	return files;
}
