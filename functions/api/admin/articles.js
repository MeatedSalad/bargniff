// Protetto da Cloudflare Access (/api/admin*): crea, modifica, elenca ed elimina articoli.
import {
  cleanArticle, getIndex, putIndex, getArticle, summary, imageIds, SLUG_RE,
} from "../../_lib/articles.js";
import { slugify } from "../../_lib/render.js";

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}

async function readJson(request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

export async function onRequestGet({ request, env }) {
  const id = new URL(request.url).searchParams.get("id");

  if (id) {
    const article = await getArticle(env, id);
    return article ? json(article) : json({ error: "Articolo non trovato." }, 404);
  }

  const list = await getIndex(env);
  list.sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")));
  return json(list);
}

export async function onRequestPost({ request, env }) {
  const body = await readJson(request);
  if (!body || typeof body !== "object") return json({ error: "Richiesta non valida." }, 400);

  let data;
  try {
    data = cleanArticle(body);
  } catch (error) {
    return json({ error: error.message }, 400);
  }

  const index = await getIndex(env);
  const requestedId = typeof body.id === "string" && SLUG_RE.test(body.id) ? body.id : "";
  const existing = requestedId ? await getArticle(env, requestedId) : null;

  let id = existing ? existing.id : "";
  if (!id) {
    const base = slugify(data.title);
    const taken = new Set(index.map((a) => a.id));
    id = base;
    for (let n = 2; taken.has(id) || (await getArticle(env, id)); n++) id = `${base}-${n}`;
  }

  const now = new Date().toISOString();
  const article = { ...data, id, createdAt: existing?.createdAt || now, updatedAt: now };

  await env.BARGNIFF.put(`article:${id}`, JSON.stringify(article));
  await putIndex(env, [summary(article), ...index.filter((a) => a.id !== id)]);

  // elimina le foto tolte dall'articolo
  if (existing) {
    const keep = new Set(imageIds(article));
    for (const img of imageIds(existing)) if (!keep.has(img)) await env.BARGNIFF.delete(`img:${img}`);
  }

  return json({ ok: true, id, article: summary(article) });
}

export async function onRequestDelete({ request, env }) {
  const body = await readJson(request);
  const id = body && typeof body.id === "string" ? body.id : "";
  const article = await getArticle(env, id);
  if (!article) return json({ error: "Articolo non trovato." }, 404);

  await env.BARGNIFF.delete(`article:${id}`);
  await putIndex(env, (await getIndex(env)).filter((a) => a.id !== id));
  for (const img of imageIds(article)) await env.BARGNIFF.delete(`img:${img}`);

  return json({ ok: true });
}
