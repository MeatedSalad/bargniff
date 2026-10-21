// Scheda "Post Instagram": gli ultimi 3 post mostrati in home.
// Per ogni post si può caricare una foto di anteprima e scrivere un breve testo: con la foto
// il post si vede subito in home, senza contattare Instagram (più veloce e più rispettoso della privacy).

import { $, api, sendJson, toast } from "./util.js";
import { pickFile, uploadImage } from "./image-upload.js";

const ENDPOINT = "/api/admin/instagram";
// Le schede in home sono larghe al massimo 540 px: 900 px bastano anche per gli schermi più nitidi.
const PREVIEW_MAX_SIDE = 900;

// Foto scelta per il post che si sta per aggiungere (già caricata sul server).
let pendingImageId = "";

export function setupInstagramTab() {
	$("#instagram-photo-button").addEventListener("click", choosePendingPhoto);
	$("#instagram-add").addEventListener("click", addPost);
	$("#instagram-url").addEventListener("keydown", (event) => {
		if (event.key === "Enter") addPost();
	});
}

export async function loadInstagramPosts() {
	const list = $("#instagram-list");

	try {
		const posts = await api("/api/instagram", { cache: "no-store" });

		if (posts.length === 0) {
			list.innerHTML = '<div class="empty-state">Nessun post. Incolla un link qui sopra.</div>';
			return;
		}
		list.replaceChildren(...posts.map(createRow));
	} catch (error) {
		toast(error.message, true);
	}
}

/* ---------- nuovo post ---------- */

async function choosePendingPhoto() {
	const file = await pickFile();
	if (!file) return;

	$("#instagram-photo-name").textContent = "Carico la foto…";
	try {
		pendingImageId = (await uploadImage(file, { maxSide: PREVIEW_MAX_SIDE })).id;
		$("#instagram-photo-name").textContent = `Foto pronta: ${file.name}`;
	} catch (error) {
		pendingImageId = "";
		$("#instagram-photo-name").textContent = "";
		toast(error.message, true);
	}
}

async function addPost() {
	const urlInput = $("#instagram-url");
	const captionInput = $("#instagram-caption");
	if (!urlInput.value.trim()) return;

	try {
		await sendJson(ENDPOINT, "POST", {
			url: urlInput.value.trim(),
			caption: captionInput.value,
			image: pendingImageId,
		});

		urlInput.value = "";
		captionInput.value = "";
		pendingImageId = "";
		$("#instagram-photo-name").textContent = "";

		toast("Post aggiunto.");
		loadInstagramPosts();
	} catch (error) {
		toast(error.message, true);
	}
}

/* ---------- post già presenti ---------- */

function createButton(label, className, onClick) {
	const button = document.createElement("button");
	button.type = "button";
	button.className = className;
	button.textContent = label;
	button.addEventListener("click", onClick);
	return button;
}

async function updatePost(url, changes, successMessage) {
	try {
		await sendJson(ENDPOINT, "PATCH", { url, ...changes });
		if (successMessage) toast(successMessage);
		loadInstagramPosts();
	} catch (error) {
		toast(error.message, true);
	}
}

async function changePhoto(post) {
	const file = await pickFile();
	if (!file) return;

	try {
		const { id } = await uploadImage(file, { maxSide: PREVIEW_MAX_SIDE });
		await updatePost(post.url, { image: id }, "Foto aggiornata.");
	} catch (error) {
		toast(error.message, true);
	}
}

async function removePost(post) {
	if (!confirm("Rimuovere questo post dal sito?")) return;

	try {
		await sendJson(ENDPOINT, "DELETE", { url: post.url });
		loadInstagramPosts();
	} catch (error) {
		toast(error.message, true);
	}
}

function createRow(post, index) {
	const row = document.createElement("div");
	row.className = "instagram-row";

	const thumbnail = document.createElement("div");
	thumbnail.className = "instagram-thumb";
	if (post.image) {
		const image = document.createElement("img");
		image.src = `/api/img/${encodeURIComponent(post.image)}`;
		image.alt = "";
		thumbnail.append(image);
	} else {
		thumbnail.textContent = "Nessuna foto";
	}

	const main = document.createElement("div");
	main.className = "instagram-row-main";

	const link = document.createElement("a");
	link.href = post.url;
	link.target = "_blank";
	link.rel = "noopener noreferrer";
	link.textContent = `${index + 1}. ${post.url.replace("https://www.instagram.com/", "")}`;

	const caption = document.createElement("input");
	caption.value = post.caption;
	caption.maxLength = 160;
	caption.placeholder = "Testo breve (facoltativo)";
	caption.addEventListener("change", () =>
		updatePost(post.url, { caption: caption.value }, "Testo salvato."),
	);

	main.append(link, caption);

	const actions = document.createElement("div");
	actions.className = "instagram-row-actions";
	actions.append(
		createButton(post.image ? "Cambia foto" : "Aggiungi foto", "btn small", () =>
			changePhoto(post),
		),
	);
	if (post.image) {
		actions.append(
			createButton("Togli foto", "btn small", () =>
				updatePost(post.url, { image: null }, "Foto tolta."),
			),
		);
	}
	actions.append(createButton("Rimuovi", "btn small danger", () => removePost(post)));

	row.append(thumbnail, main, actions);
	return row;
}
