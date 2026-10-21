// Protetto da Cloudflare Access (/api/admin*): dati per la copia di sicurezza.
// Restituisce articoli e post; le foto le scarica la pagina admin una per una (/api/img/<id>) e
// compone il file di backup nel browser, così il server non deve fare lavoro pesante.
import { getArticle, getIndex, imageIds } from "../../_lib/articles.js";
import { jsonResponse } from "../../_lib/http.js";
import { imageIdsOf, readPosts } from "../../_lib/instagram.js";

export async function onRequestGet({ env }) {
	const articles = [];
	for (const item of await getIndex(env)) {
		const article = await getArticle(env, item.id);
		if (article) articles.push(article);
	}

	const posts = await readPosts(env);
	const usedImages = new Set([...articles.flatMap(imageIds), ...imageIdsOf(posts)]);

	return jsonResponse({ articles, posts, imageIds: [...usedImages] });
}
