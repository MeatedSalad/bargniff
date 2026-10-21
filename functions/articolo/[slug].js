// Pubblico: pagina di un articolo pubblicato, pronta per la stampa.
import { getArticle } from "../_lib/articles.js";
import { htmlResponse } from "../_lib/http.js";
import { renderArticle, renderNotFound } from "../_lib/render.js";

export async function onRequestGet({ params, env, request }) {
	const article = await getArticle(env, String(params.slug || ""));
	if (!article || article.status !== "published") {
		return htmlResponse(renderNotFound(), { status: 404 });
	}

	const html = renderArticle(article, { origin: new URL(request.url).origin });
	return htmlResponse(html, { cache: "public, max-age=60" });
}
