// Elenco degli articoli (bozze e pubblicati) con i pulsanti per modificarli.

import { $, api, formatDate, toast } from "./util.js";

let onEdit = () => {};

export function setupArticleList({ onEdit: editHandler }) {
	onEdit = editHandler;
	$("#btn-new").addEventListener("click", () => onEdit(null));
}

export async function loadArticleList() {
	const box = $("#article-list");
	box.innerHTML = '<p class="muted">Carico…</p>';

	try {
		const articles = await api("/api/admin/articles", { cache: "no-store" });

		if (articles.length === 0) {
			box.innerHTML =
				'<div class="empty-state">Non hai ancora scritto articoli.<br>Clicca «Nuovo articolo» per cominciare.</div>';
			return;
		}
		box.replaceChildren(...articles.map(createRow));
	} catch (error) {
		box.textContent = "";
		toast(error.message, true);
	}
}

function createButton(label, className, onClick) {
	const button = document.createElement("button");
	button.type = "button";
	button.className = className;
	button.textContent = label;
	button.addEventListener("click", onClick);
	return button;
}

function createRow(article) {
	const isPublished = article.status === "published";
	const row = document.createElement("div");
	row.className = "article-row";

	const text = document.createElement("div");
	text.className = "article-row-text";
	const title = document.createElement("b");
	title.textContent = article.title;
	const date = document.createElement("span");
	date.className = "muted";
	date.textContent = formatDate(article.date);
	text.append(title, date);

	const badge = document.createElement("span");
	badge.className = `badge ${isPublished ? "pub" : "draft"}`;
	badge.textContent = isPublished ? "Pubblicato" : "Bozza";

	const id = encodeURIComponent(article.id);
	row.append(
		text,
		badge,
		createButton("Modifica", "btn small primary", () => onEdit(article.id)),
		createButton("Anteprima", "btn small", () => window.open(`/admin/preview/${id}`, "_blank")),
	);

	if (isPublished) {
		row.append(
			createButton("Vedi online", "btn small", () => window.open(`/articolo/${id}`, "_blank")),
		);
	}
	return row;
}
