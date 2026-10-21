// Pubblico: archivio di tutti gli articoli pubblicati.
import { getIndex, publishedSorted } from "../_lib/articles.js";
import { htmlResponse } from "../_lib/http.js";
import { renderArchive } from "../_lib/render.js";

export async function onRequestGet({ env }) {
	const html = renderArchive(publishedSorted(await getIndex(env)));
	return htmlResponse(html, { cache: "public, max-age=60" });
}
