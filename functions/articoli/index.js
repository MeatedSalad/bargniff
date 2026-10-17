// Pubblico: archivio di tutti gli articoli pubblicati.
import { getIndex, publishedSorted } from "../_lib/articles.js";
import { renderArchive, htmlResponse } from "../_lib/render.js";

export async function onRequestGet({ env }) {
  return htmlResponse(renderArchive(publishedSorted(await getIndex(env))), 200, "public, max-age=60");
}
