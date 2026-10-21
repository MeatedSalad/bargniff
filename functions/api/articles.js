// Pubblico: elenco degli articoli pubblicati (usato dalla home).
import { jsonResponse } from "../_lib/http.js";
import { getIndex, publishedSorted } from "../_lib/articles.js";

export async function onRequestGet({ env }) {
	const articles = publishedSorted(await getIndex(env)).map(
		({ id, title, subtitle, date, excerpt, cover }) => ({
			id,
			title,
			subtitle,
			date,
			excerpt,
			cover,
		}),
	);

	return jsonResponse(articles, { cache: "public, max-age=60" });
}
