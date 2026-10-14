const VALID = /^https:\/\/(www\.)?instagram\.com\/(p|reel)\/[\w-]+\/?(\?[\w=&%.-]*)?$/;

async function getList(env) {
  return JSON.parse((await env.BARGNIFF.get("posts")) || "[]");
}

// aggiunge un post in cima, tiene solo gli ultimi 3
export async function onRequestPost({ request, env }) {
  const { url } = await request.json();
  if (!VALID.test(url)) return new Response("URL non valido", { status: 400 });

  const list = await getList(env);
  const next = [url, ...list.filter((u) => u !== url)].slice(0, 3);
  await env.BARGNIFF.put("posts", JSON.stringify(next));
  return Response.json(next);
}

// toglie un post dalla lista
export async function onRequestDelete({ request, env }) {
  const { url } = await request.json();

  const list = await getList(env);
  const next = list.filter((u) => u !== url);
  await env.BARGNIFF.put("posts", JSON.stringify(next));
  return Response.json(next);
}