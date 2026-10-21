// Copia di sicurezza: scarica in un file tutti gli articoli, le foto e i post Instagram,
// e permette di ripristinarli da quel file.
//
// Non è necessaria per gli aggiornamenti del sito (articoli e foto stanno nell'archivio di Cloudflare,
// separato dal codice), ma è una precauzione in più, ad esempio prima di cambiare progetto.

import { $, api, sendJson, toast } from "./util.js";
import { pickFile } from "./image-upload.js";

const BACKUP_VERSION = 1;

export function setupBackup() {
	$("#backup-download").addEventListener("click", downloadBackup);
	$("#backup-restore").addEventListener("click", restoreBackup);
}

function setStatus(text) {
	$("#backup-status").textContent = text;
}

function blobToBase64(blob) {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => resolve(String(reader.result).split(",")[1]);
		reader.onerror = reject;
		reader.readAsDataURL(blob);
	});
}

async function downloadBackup() {
	try {
		setStatus("Preparo la copia…");
		const { articles, posts, imageIds } = await api("/api/admin/backup", { cache: "no-store" });

		const images = {};
		for (const [i, id] of imageIds.entries()) {
			setStatus(`Scarico le foto (${i + 1} di ${imageIds.length})…`);
			const response = await fetch(`/api/img/${encodeURIComponent(id)}`);
			if (!response.ok) continue;

			const blob = await response.blob();
			images[id] = { type: blob.type || "image/jpeg", data: await blobToBase64(blob) };
		}

		const backup = {
			version: BACKUP_VERSION,
			savedAt: new Date().toISOString(),
			articles,
			posts,
			images,
		};
		const file = new Blob([JSON.stringify(backup)], { type: "application/json" });

		const link = document.createElement("a");
		link.href = URL.createObjectURL(file);
		link.download = `bargniff-copia-${new Date().toLocaleDateString("sv-SE")}.json`;
		link.click();
		URL.revokeObjectURL(link.href);

		setStatus("");
		toast(`Copia scaricata: ${articles.length} articoli, ${Object.keys(images).length} foto.`);
	} catch (error) {
		setStatus("");
		toast(error.message, true);
	}
}

function base64ToBlob(data, type) {
	const bytes = Uint8Array.from(atob(data), (char) => char.charCodeAt(0));
	return new Blob([bytes], { type });
}

async function restoreBackup() {
	const file = await pickFile({ accept: ".json,application/json" });
	if (!file) return;

	try {
		const backup = JSON.parse(await file.text());
		if (backup.version !== BACKUP_VERSION || !Array.isArray(backup.articles)) {
			throw new Error("Questo file non sembra una copia di sicurezza del sito.");
		}

		const message =
			`Ripristinare ${backup.articles.length} articoli dal file? ` +
			"Gli articoli con lo stesso indirizzo verranno sostituiti.";
		if (!confirm(message)) return;

		const images = Object.entries(backup.images || {});
		for (const [i, [id, image]] of images.entries()) {
			setStatus(`Carico le foto (${i + 1} di ${images.length})…`);
			await api(`/api/admin/upload?id=${encodeURIComponent(id)}`, {
				method: "POST",
				headers: { "content-type": image.type },
				body: base64ToBlob(image.data, image.type),
			});
		}

		setStatus("Ripristino gli articoli…");
		const result = await sendJson("/api/admin/restore", "POST", {
			articles: backup.articles,
			posts: backup.posts || [],
		});

		setStatus("");
		toast(
			`Ripristinati ${result.articles} articoli${result.skipped ? ` (${result.skipped} saltati)` : ""}.`,
		);
		window.location.reload();
	} catch (error) {
		setStatus("");
		toast(error.message, true);
	}
}
