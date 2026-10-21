// I post Instagram mostrati in home: al massimo 3, salvati nel KV con la chiave "posts".
// Ogni post ha il link, una foto di anteprima nostra (facoltativa) e un breve testo (facoltativo).

import { isImageId } from "./images.js";

export const MAX_POSTS = 3;
const MAX_CAPTION_LENGTH = 160;

const POST_URL_RE =
	/^https:\/\/(?:www\.)?instagram\.com\/(p|reel|tv)\/([\w-]+)\/?(?:\?[\w=&%.-]*)?$/;

// Porta il link alla forma essenziale, senza i parametri di tracciamento che Instagram aggiunge
// quando si condivide (ad esempio "?igsh=..."): non servono e permettono di risalire a chi ha condiviso.
export function canonicalPostUrl(input) {
	const match = POST_URL_RE.exec(String(input || "").trim());
	return match ? `https://www.instagram.com/${match[1]}/${match[2]}/` : null;
}

export function cleanCaption(value) {
	return String(value ?? "")
		.replace(/[\u0000-\u001F]/g, " ")
		.replace(/\s+/g, " ")
		.trim()
		.slice(0, MAX_CAPTION_LENGTH);
}

// Accetta sia il formato vecchio (solo il link) sia quello nuovo (oggetto).
export function cleanPost(raw) {
	const source = typeof raw === "string" ? { url: raw } : raw;
	if (!source || typeof source !== "object") return null;

	const url = canonicalPostUrl(source.url);
	if (!url) return null;

	return {
		url,
		image: isImageId(source.image) ? String(source.image) : "",
		caption: cleanCaption(source.caption),
	};
}

export async function readPosts(env) {
	try {
		const list = JSON.parse((await env.BARGNIFF.get("posts")) || "[]");
		return Array.isArray(list) ? list.map(cleanPost).filter(Boolean).slice(0, MAX_POSTS) : [];
	} catch {
		return [];
	}
}

export async function writePosts(env, posts) {
	await env.BARGNIFF.put("posts", JSON.stringify(posts.slice(0, MAX_POSTS)));
}

export function imageIdsOf(posts) {
	return posts.map((post) => post.image).filter(Boolean);
}
