// Protetto da Cloudflare Access (/api/admin*): carica una foto nel KV.
const TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_BYTES = 5 * 1024 * 1024;

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}

function matchesType(type, b) {
  if (type === "image/jpeg") return b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;
  if (type === "image/png") return b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47;
  if (type === "image/webp") {
    const riff = String.fromCharCode(b[0], b[1], b[2], b[3]);
    const webp = String.fromCharCode(b[8], b[9], b[10], b[11]);
    return riff === "RIFF" && webp === "WEBP";
  }
  return false;
}

export async function onRequestPost({ request, env }) {
  const type = (request.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
  if (!TYPES.has(type)) return json({ error: "Formato non supportato: usa JPG, PNG o WebP." }, 415);

  const buf = await request.arrayBuffer();
  if (buf.byteLength < 100) return json({ error: "File vuoto o non valido." }, 400);
  if (buf.byteLength > MAX_BYTES) return json({ error: "La foto è troppo pesante (massimo 5 MB)." }, 413);
  if (!matchesType(type, new Uint8Array(buf.slice(0, 12)))) return json({ error: "Il file non è un'immagine valida." }, 400);

  const id = crypto.randomUUID().replace(/-/g, "").slice(0, 24);
  await env.BARGNIFF.put(`img:${id}`, buf, { metadata: { type, size: buf.byteLength } });

  return json({ id, url: `/api/img/${id}` });
}
