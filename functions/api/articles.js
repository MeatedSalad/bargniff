// Pubblico: elenco degli articoli pubblicati (usato dalla home).
import { getIndex, publishedSorted } from "../_lib/articles.js";

export async function onRequestGet({ env }) {
  const list = publishedSorted(await getIndex(env)).map(
    ({ id, title, subtitle, date, excerpt, cover }) => ({ id, title, subtitle, date, excerpt, cover })
  );

  return new Response(JSON.stringify(list), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "public, max-age=30",
    },
  });
}
