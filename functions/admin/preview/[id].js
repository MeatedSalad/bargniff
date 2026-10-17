// Protetto da Cloudflare Access (/admin*): anteprima di qualsiasi articolo, anche bozza.
import { getArticle } from "../../_lib/articles.js";
import { renderArticle, renderNotFound, htmlResponse } from "../../_lib/render.js";

export async function onRequestGet({ params, env, request }) {
  const article = await getArticle(env, String(params.id || ""));
  if (!article) return htmlResponse(renderNotFound(), 404);

  const response = htmlResponse(
    renderArticle(article, { origin: new URL(request.url).origin, preview: true }),
    200,
    "no-store"
  );
  response.headers.set("x-robots-tag", "noindex, nofollow");
  return response;
}
