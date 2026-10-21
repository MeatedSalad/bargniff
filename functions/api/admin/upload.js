// Protetto da Cloudflare Access (/api/admin*): carica una foto nel KV.
// Con "?id=..." la foto viene salvata con quell'identificativo (serve solo a ripristinare una copia di sicurezza).
import { errorResponse, jsonResponse, refuseCrossSiteRequest } from "../../_lib/http.js";
import { IMAGE_TYPES, isImageId, looksLikeImage } from "../../_lib/images.js";

const MAX_BYTES = 5 * 1024 * 1024;

export async function onRequestPost({ request, env }) {
	const refusal = refuseCrossSiteRequest(request);
	if (refusal) return refusal;

	const type = (request.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
	if (!IMAGE_TYPES.has(type))
		return errorResponse("Formato non supportato: usa JPG, PNG o WebP.", 415);

	const data = await request.arrayBuffer();
	if (data.byteLength < 100) return errorResponse("File vuoto o non valido.");
	if (data.byteLength > MAX_BYTES)
		return errorResponse("La foto è troppo pesante (massimo 5 MB).", 413);
	if (!looksLikeImage(type, new Uint8Array(data.slice(0, 12)))) {
		return errorResponse("Il file non è un'immagine valida.");
	}

	const requestedId = new URL(request.url).searchParams.get("id");
	if (requestedId && !isImageId(requestedId)) return errorResponse("Identificativo non valido.");

	const id = requestedId || crypto.randomUUID().replace(/-/g, "").slice(0, 24);
	await env.BARGNIFF.put(`img:${id}`, data, { metadata: { type, size: data.byteLength } });

	return jsonResponse({ id, url: `/api/img/${id}` });
}
