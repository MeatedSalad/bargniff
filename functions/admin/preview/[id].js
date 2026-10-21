// Protetto da Cloudflare Access (/admin*): anteprima di qualsiasi articolo, anche bozza.
import { getArticle } from "../../_lib/articles.js";
import { htmlResponse } from "../../_lib/http.js";
import { renderArticle, renderNotFound } from "../../_lib/render.js";

export async function onRequestGet({ params, env, request }) {
	const article = await getArticle(env, String(params.id || ""));
	if (!article) return htmlResponse(renderNotFound(), { status: 404 });

	const html = renderArticle(article, { origin: new URL(request.url).origin, preview: true });
	const response = htmlResponse(html);
	response.headers.set("x-robots-tag", "noindex, nofollow");
	return response;
}
