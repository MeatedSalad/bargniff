// Pubblico: serve le foto caricate dall'admin.
import { IMG_ID_RE } from "../../_lib/articles.js";

export async function onRequestGet({ params, env }) {
  const id = String(params.id || "");
  if (!IMG_ID_RE.test(id)) return new Response("Not found", { status: 404 });

  const { value, metadata } = await env.BARGNIFF.getWithMetadata(`img:${id}`, { type: "arrayBuffer" });
  if (!value) return new Response("Not found", { status: 404 });

  return new Response(value, {
    headers: {
      "content-type": metadata?.type || "image/jpeg",
      "cache-control": "public, max-age=31536000, immutable",
      "x-content-type-options": "nosniff",
      "content-security-policy": "default-src 'none'",
    },
  });
}
