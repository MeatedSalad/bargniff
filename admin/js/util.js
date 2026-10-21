// Piccoli aiuti usati in tutto l'admin.

export const $ = (selector, root = document) => root.querySelector(selector);
export const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

export const todayISO = () => new Date().toLocaleDateString("sv-SE");

export function formatDate(isoDate) {
	const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate || "");
	if (!match) return "";

	const [, year, month, day] = match;
	return new Date(+year, +month - 1, +day).toLocaleDateString("it-IT", {
		day: "numeric",
		month: "long",
		year: "numeric",
	});
}

// Messaggio temporaneo in basso nella pagina.
let toastTimer;

export function toast(message, isError = false) {
	const element = $("#toast");
	element.textContent = message;
	element.classList.toggle("err", isError);
	element.classList.add("show");

	clearTimeout(toastTimer);
	toastTimer = setTimeout(() => element.classList.remove("show"), isError ? 6000 : 2600);
}

// Chiamata al server che restituisce JSON. In caso di errore solleva un Error con un messaggio leggibile.
export async function api(path, options = {}) {
	let response;
	try {
		response = await fetch(path, { credentials: "same-origin", ...options });
	} catch {
		throw new Error("Connessione non riuscita. Se la sessione è scaduta, ricarica la pagina.");
	}

	if (!response.ok) {
		const text = await response.text();
		let message = text;
		try {
			message = JSON.parse(text).error || text;
		} catch {
			// La risposta non era JSON: usiamo il testo così com'è.
		}
		throw new Error((message || `Errore ${response.status}`).slice(0, 300));
	}

	const type = response.headers.get("content-type") || "";
	if (!type.includes("json")) {
		throw new Error("Risposta inattesa: la sessione potrebbe essere scaduta. Ricarica la pagina.");
	}
	return response.json();
}

// Invia dati in JSON (POST, PATCH, DELETE...).
export function sendJson(path, method, data) {
	return api(path, {
		method,
		headers: { "content-type": "application/json" },
		body: JSON.stringify(data),
	});
}
