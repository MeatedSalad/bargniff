// Le foto caricate dall'admin stanno nel KV con la chiave "img:<id>".

export const IMAGE_ID_RE = /^[a-z0-9-]{8,40}$/;

export function isImageId(value) {
	return IMAGE_ID_RE.test(String(value || ""));
}

export async function deleteImages(env, ids) {
	for (const id of new Set(ids)) {
		if (isImageId(id)) await env.BARGNIFF.delete(`img:${id}`);
	}
}

export const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

// Controlla i primi byte del file: deve essere davvero un'immagine del tipo dichiarato.
export function looksLikeImage(type, bytes) {
	if (type === "image/jpeg") return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
	if (type === "image/png") {
		return bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
	}
	if (type === "image/webp") {
		const riff = String.fromCharCode(...bytes.slice(0, 4));
		const webp = String.fromCharCode(...bytes.slice(8, 12));
		return riff === "RIFF" && webp === "WEBP";
	}
	return false;
}
