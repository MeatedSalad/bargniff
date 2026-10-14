export async function onRequestGet({ env }) {
  return new Response((await env.BARGNIFF.get("posts")) || "[]", {
    headers: { "content-type": "application/json" },
  });
}
