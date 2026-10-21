// Piccoli aiuti per costruire risposte HTTP coerenti e sicure.

// Cosa può caricare una pagina del sito. Instagram è ammesso solo perché i post incorporati
// partono unicamente dopo il click del visitatore (vedi assets/js/instagram.js).
// Questa regola va tenuta uguale a quella nel file _headers, che copre i file statici.
export const CONTENT_SECURITY_POLICY = [
	"default-src 'self'",
	"script-src 'self' https://www.instagram.com",
	"style-src 'self' 'unsafe-inline'",
	"img-src 'self' data:",
	"font-src 'self'",
	"connect-src 'self' https://www.instagram.com",
	"frame-src https://www.instagram.com",
	"object-src 'none'",
	"base-uri 'self'",
	"form-action 'self'",
	"frame-ancestors 'none'",
].join("; ");

const SECURITY_HEADERS = {
	"content-security-policy": CONTENT_SECURITY_POLICY,
	"x-content-type-options": "nosniff",
	"x-frame-options": "DENY",
	"referrer-policy": "strict-origin-when-cross-origin",
	"permissions-policy": "camera=(), microphone=(), geolocation=(), interest-cohort=()",
};

export function jsonResponse(data, { status = 200, cache = "no-store" } = {}) {
	return new Response(JSON.stringify(data), {
		status,
		headers: {
			...SECURITY_HEADERS,
			"content-type": "application/json; charset=utf-8",
			"cache-control": cache,
		},
	});
}

export function errorResponse(message, status = 400) {
	return jsonResponse({ error: message }, { status });
}

export function htmlResponse(html, { status = 200, cache = "no-store" } = {}) {
	return new Response(html, {
		status,
		headers: {
			...SECURITY_HEADERS,
			"content-type": "text/html; charset=utf-8",
			"cache-control": cache,
		},
	});
}

// Le operazioni dell'admin che modificano dati devono arrivare dal nostro stesso sito:
// così un'altra pagina web non può far scrivere, a nome di un'admin loggata, richieste di nascosto.
export function refuseCrossSiteRequest(request) {
	const fetchSite = request.headers.get("sec-fetch-site");
	if (fetchSite && fetchSite !== "same-origin" && fetchSite !== "none") {
		return errorResponse("Richiesta non consentita.", 403);
	}

	const origin = request.headers.get("origin");
	if (origin && origin !== new URL(request.url).origin) {
		return errorResponse("Richiesta non consentita.", 403);
	}

	return null;
}

// Legge il JSON di una richiesta dell'admin. Restituisce { body } oppure { response } con l'errore da inviare.
export async function readAdminJson(request) {
	const refusal = refuseCrossSiteRequest(request);
	if (refusal) return { response: refusal };

	const type = (request.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
	if (type !== "application/json") {
		return { response: errorResponse("Formato della richiesta non valido.", 415) };
	}

	try {
		const body = await request.json();
		if (!body || typeof body !== "object") throw new Error("not an object");
		return { body };
	} catch {
		return { response: errorResponse("Richiesta non valida.", 400) };
	}
}
