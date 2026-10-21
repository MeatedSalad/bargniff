// Protetto da Cloudflare Access (/api/admin*): ripristina articoli e post da una copia di sicurezza.
// Le foto vanno caricate prima (con /api/admin/upload?id=...). Gli articoli già presenti con lo
// stesso indirizzo vengono sostituiti; gli altri restano dove sono.
import { cleanArticle, getIndex, putIndex, summary, SLUG_RE } from "../../_lib/articles.js";
import { jsonResponse, readAdminJson } from "../../_lib/http.js";
import { cleanPost, writePosts } from "../../_lib/instagram.js";

const MAX_ARTICLES = 500;

function validDate(value) {
	return typeof value === "string" && !Number.isNaN(Date.parse(value)) ? value : null;
}

export async function onRequestPost({ request, env }) {
	const { body, response } = await readAdminJson(request);
	if (response) return response;

	const index = await getIndex(env);
	const byId = new Map(index.map((item) => [item.id, item]));

	let restored = 0;
	let skipped = 0;

	for (const raw of (Array.isArray(body.articles) ? body.articles : []).slice(0, MAX_ARTICLES)) {
		const id = raw && typeof raw.id === "string" ? raw.id : "";
		if (!SLUG_RE.test(id) || id.length > 80) {
			skipped++;
			continue;
		}

		try {
			const now = new Date().toISOString();
			const article = {
				...cleanArticle(raw),
				id,
				createdAt: validDate(raw.createdAt) || now,
				updatedAt: validDate(raw.updatedAt) || now,
			};
			await env.BARGNIFF.put(`article:${id}`, JSON.stringify(article));
			byId.set(id, summary(article));
			restored++;
		} catch {
			skipped++;
		}
	}

	await putIndex(env, [...byId.values()]);

	const posts = (Array.isArray(body.posts) ? body.posts : []).map(cleanPost).filter(Boolean);
	if (posts.length > 0) await writePosts(env, posts);

	return jsonResponse({ ok: true, articles: restored, skipped, posts: Math.min(posts.length, 3) });
}
