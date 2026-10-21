// Protetto da Cloudflare Access (/api/admin*): crea, modifica, elenca ed elimina articoli.
import {
	cleanArticle,
	getIndex,
	putIndex,
	getArticle,
	summary,
	imageIds,
	SLUG_RE,
} from "../../_lib/articles.js";
import { deleteImages } from "../../_lib/images.js";
import { errorResponse, jsonResponse, readAdminJson } from "../../_lib/http.js";
import { slugify } from "../../_lib/text.js";

// Senza "id" restituisce l'elenco di tutti gli articoli (bozze comprese); con "?id=" un articolo intero.
export async function onRequestGet({ request, env }) {
	const id = new URL(request.url).searchParams.get("id");

	if (id) {
		const article = await getArticle(env, id);
		return article ? jsonResponse(article) : errorResponse("Articolo non trovato.", 404);
	}

	const list = await getIndex(env);
	list.sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")));
	return jsonResponse(list);
}

// Crea un nuovo articolo oppure aggiorna quello indicato da "id".
export async function onRequestPost({ request, env }) {
	const { body, response } = await readAdminJson(request);
	if (response) return response;

	let data;
	try {
		data = cleanArticle(body);
	} catch (error) {
		return errorResponse(error.message);
	}

	const index = await getIndex(env);
	const requestedId = typeof body.id === "string" && SLUG_RE.test(body.id) ? body.id : "";
	const existing = requestedId ? await getArticle(env, requestedId) : null;

	const id = existing ? existing.id : await newUniqueSlug(env, index, data.title);
	const now = new Date().toISOString();
	const article = { ...data, id, createdAt: existing?.createdAt || now, updatedAt: now };

	await env.BARGNIFF.put(`article:${id}`, JSON.stringify(article));
	await putIndex(env, [summary(article), ...index.filter((item) => item.id !== id)]);

	// Le foto tolte dall'articolo non servono più: le cancelliamo.
	if (existing) {
		const stillUsed = new Set(imageIds(article));
		await deleteImages(
			env,
			imageIds(existing).filter((imageId) => !stillUsed.has(imageId)),
		);
	}

	return jsonResponse({ ok: true, id, article: summary(article) });
}

export async function onRequestDelete({ request, env }) {
	const { body, response } = await readAdminJson(request);
	if (response) return response;

	const article = await getArticle(env, typeof body.id === "string" ? body.id : "");
	if (!article) return errorResponse("Articolo non trovato.", 404);

	await env.BARGNIFF.delete(`article:${article.id}`);
	await putIndex(
		env,
		(await getIndex(env)).filter((item) => item.id !== article.id),
	);
	await deleteImages(env, imageIds(article));

	return jsonResponse({ ok: true });
}

// Dal titolo ricava un indirizzo libero: "titolo", poi "titolo-2", "titolo-3"...
async function newUniqueSlug(env, index, title) {
	const base = slugify(title);
	const taken = new Set(index.map((item) => item.id));

	let slug = base;
	for (let n = 2; taken.has(slug) || (await getArticle(env, slug)); n++) slug = `${base}-${n}`;
	return slug;
}
