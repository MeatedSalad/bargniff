// Scelta e caricamento delle foto. Prima di inviarle le ridimensioniamo e le salviamo in JPEG:
// le foto pesano meno, e nel passaggio spariscono i dati nascosti nel file (ad esempio la posizione GPS).

import { api } from "./util.js";

// Apre la finestra di scelta del file (di default una foto). Restituisce il file scelto oppure null.
export function pickFile({ accept = "image/*" } = {}) {
	return new Promise((resolve) => {
		const input = document.createElement("input");
		input.type = "file";
		input.accept = accept;
		input.addEventListener("change", () => resolve(input.files[0] || null));
		input.addEventListener("cancel", () => resolve(null));
		input.click();
	});
}

async function resizeToJpeg(file, maxSide) {
	let bitmap;
	try {
		bitmap = await createImageBitmap(file);
	} catch {
		throw new Error("Non riesco a leggere questa immagine. Prova con una foto JPG o PNG.");
	}

	const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
	const canvas = document.createElement("canvas");
	canvas.width = Math.max(1, Math.round(bitmap.width * scale));
	canvas.height = Math.max(1, Math.round(bitmap.height * scale));

	const context = canvas.getContext("2d");
	context.fillStyle = "#fff";
	context.fillRect(0, 0, canvas.width, canvas.height);
	context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

	return new Promise((resolve, reject) => {
		canvas.toBlob(
			(blob) => (blob ? resolve(blob) : reject(new Error("Immagine non valida."))),
			"image/jpeg",
			0.86,
		);
	});
}

// Carica la foto e restituisce { id, url }.
export async function uploadImage(file, { maxSide = 1800 } = {}) {
	const blob = await resizeToJpeg(file, maxSide);
	return api("/api/admin/upload", {
		method: "POST",
		headers: { "content-type": "image/jpeg" },
		body: blob,
	});
}
