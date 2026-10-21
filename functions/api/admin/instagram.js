// Protetto da Cloudflare Access (/api/admin*): gestisce i post Instagram mostrati in home.
//   POST   aggiunge un post in cima (gli altri scalano, il più vecchio esce oltre il terzo)
//   PATCH  cambia foto o testo di un post già presente
//   DELETE toglie un post
import { errorResponse, jsonResponse, readAdminJson } from "../../_lib/http.js";
import { deleteImages, isImageId } from "../../_lib/images.js";
import {
	canonicalPostUrl,
	cleanCaption,
	imageIdsOf,
	MAX_POSTS,
	readPosts,
	writePosts,
} from "../../_lib/instagram.js";

// Salva la nuova lista e cancella le foto che non sono più usate da nessun post.
async function saveAndCleanUp(env, before, after) {
	await writePosts(env, after);

	const stillUsed = new Set(imageIdsOf(after));
	await deleteImages(
		env,
		imageIdsOf(before).filter((id) => !stillUsed.has(id)),
	);
}

export async function onRequestPost({ request, env }) {
	const { body, response } = await readAdminJson(request);
	if (response) return response;

	const url = canonicalPostUrl(body.url);
	if (!url) return errorResponse("Il link non sembra un post o un reel di Instagram.");

	const before = await readPosts(env);
	const existing = before.find((post) => post.url === url);

	const post = {
		url,
		image: isImageId(body.image) ? body.image : existing?.image || "",
		caption: "caption" in body ? cleanCaption(body.caption) : existing?.caption || "",
	};

	const after = [post, ...before.filter((item) => item.url !== url)].slice(0, MAX_POSTS);
	await saveAndCleanUp(env, before, after);
	return jsonResponse(after);
}

export async function onRequestPatch({ request, env }) {
	const { body, response } = await readAdminJson(request);
	if (response) return response;

	const url = canonicalPostUrl(body.url);
	const before = await readPosts(env);
	if (!url || !before.some((post) => post.url === url))
		return errorResponse("Post non trovato.", 404);

	const after = before.map((post) => {
		if (post.url !== url) return post;

		const updated = { ...post };
		if ("caption" in body) updated.caption = cleanCaption(body.caption);
		if (body.image === null || body.image === "") updated.image = "";
		else if (isImageId(body.image)) updated.image = body.image;
		return updated;
	});

	await saveAndCleanUp(env, before, after);
	return jsonResponse(after);
}

export async function onRequestDelete({ request, env }) {
	const { body, response } = await readAdminJson(request);
	if (response) return response;

	const url = canonicalPostUrl(body.url);
	const before = await readPosts(env);
	const after = before.filter((post) => post.url !== url);

	await saveAndCleanUp(env, before, after);
	return jsonResponse(after);
}
