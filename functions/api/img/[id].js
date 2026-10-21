// Pubblico: serve le foto caricate dall'admin.
import { isImageId } from "../../_lib/images.js";

export async function onRequestGet({ params, env }) {
	const id = String(params.id || "");
	if (!isImageId(id)) return new Response("Not found", { status: 404 });

	const { value, metadata } = await env.BARGNIFF.getWithMetadata(`img:${id}`, {
		type: "arrayBuffer",
	});
	if (!value) return new Response("Not found", { status: 404 });

	// Ogni foto ha un identificativo unico e non cambia mai: il browser può tenerla per un anno.
	return new Response(value, {
		headers: {
			"content-type": metadata?.type || "image/jpeg",
			"cache-control": "public, max-age=31536000, immutable",
			"x-content-type-options": "nosniff",
			"content-security-policy": "default-src 'none'",
		},
	});
}
