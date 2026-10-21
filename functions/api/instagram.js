// Pubblico: elenco dei post Instagram da mostrare in home.
import { jsonResponse } from "../_lib/http.js";
import { readPosts } from "../_lib/instagram.js";

export async function onRequestGet({ env }) {
	return jsonResponse(await readPosts(env), { cache: "public, max-age=60" });
}
