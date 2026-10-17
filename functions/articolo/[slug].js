// Pubblico: pagina di un articolo pubblicato, pronta per la stampa.
import { getArticle } from "../_lib/articles.js";
import { renderArticle, renderNotFound, htmlResponse } from "../_lib/render.js";

export async function onRequestGet({ params, env, request }) {
  const article = await getArticle(env, String(params.slug || ""));
  if (!article || article.status !== "published") return htmlResponse(renderNotFound(), 404);

  return htmlResponse(
    renderArticle(article, { origin: new URL(request.url).origin }),
    200,
    "public, max-age=60"
  );
}
