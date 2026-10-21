// Validazione degli articoli e accesso al KV (binding BARGNIFF).
// Chiavi usate: "article:<slug>" per ogni articolo e "articles:index" per l'elenco.

import { sanitizeInline, plainText } from "./text.js";
import { isImageId } from "./images.js";

export const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+){0,40}$/;

const LAYOUTS = new Set(["full", "center", "left", "right"]);

function str(value, max) {
	return String(value ?? "")
		.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
		.trim()
		.slice(0, max);
}

function today() {
	return new Date().toISOString().slice(0, 10);
}

function makeExcerpt(blocks) {
	const first = blocks.find((b) => b.type === "p" && plainText(b.html));
	if (!first) return "";
	const text = plainText(first.html);
	if (text.length <= 190) return text;
	return text.slice(0, 190).replace(/\s+\S*$/, "") + "…";
}

export function cleanArticle(body) {
	const title = str(body.title, 200);
	if (!title) throw new Error("Scrivi un titolo prima di salvare.");

	const blocks = (Array.isArray(body.blocks) ? body.blocks.slice(0, 300) : [])
		.map((b) => {
			if (!b || typeof b !== "object") return null;
			if (b.type === "p" || b.type === "q") {
				const html = sanitizeInline(b.html);
				return plainText(html) ? { type: b.type, html } : null;
			}
			if (b.type === "h") {
				const html = sanitizeInline(b.html, { allowSup: false });
				return plainText(html) ? { type: "h", html } : null;
			}
			if (b.type === "img") {
				if (!isImageId(b.src)) return null;
				return {
					type: "img",
					src: String(b.src),
					alt: str(b.alt, 200),
					caption: str(b.caption, 400),
					layout: LAYOUTS.has(b.layout) ? b.layout : "full",
				};
			}
			if (b.type === "hr") return { type: "hr" };
			return null;
		})
		.filter(Boolean);

	const notes = (Array.isArray(body.notes) ? body.notes.slice(0, 60) : []).map((n) => str(n, 600));
	while (notes.length && !notes[notes.length - 1]) notes.pop();

	return {
		title,
		subtitle: str(body.subtitle, 300),
		author: str(body.author, 100),
		place: str(body.place, 60),
		signature: str(body.signature, 100),
		date: /^\d{4}-\d{2}-\d{2}$/.test(String(body.date || "")) ? body.date : today(),
		showDateline: body.showDateline !== false,
		status: body.status === "published" ? "published" : "draft",
		cover: isImageId(body.cover) ? String(body.cover) : "",
		blocks,
		notes,
		excerpt: makeExcerpt(blocks),
	};
}

export function summary(a) {
	return {
		id: a.id,
		title: a.title,
		subtitle: a.subtitle || "",
		date: a.date,
		status: a.status,
		excerpt: a.excerpt || "",
		cover: a.cover || "",
		updatedAt: a.updatedAt,
	};
}

export async function getIndex(env) {
	try {
		const list = JSON.parse((await env.BARGNIFF.get("articles:index")) || "[]");
		return Array.isArray(list) ? list : [];
	} catch {
		return [];
	}
}

export async function putIndex(env, list) {
	await env.BARGNIFF.put("articles:index", JSON.stringify(list));
}

export async function getArticle(env, id) {
	if (!SLUG_RE.test(String(id || "")) || String(id).length > 80) return null;
	const raw = await env.BARGNIFF.get(`article:${id}`);
	if (!raw) return null;
	try {
		return JSON.parse(raw);
	} catch {
		return null;
	}
}

export function publishedSorted(list) {
	return list
		.filter((a) => a.status === "published")
		.sort(
			(a, b) =>
				String(b.date || "").localeCompare(String(a.date || "")) ||
				String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")),
		);
}

export function imageIds(article) {
	const ids = new Set();
	if (article.cover) ids.add(article.cover);
	for (const b of article.blocks || []) if (b.type === "img" && b.src) ids.add(b.src);
	return [...ids];
}
