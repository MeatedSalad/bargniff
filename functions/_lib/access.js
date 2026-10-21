// Seconda serratura per l'area admin.
//
// Cloudflare Access chiede il login prima di far arrivare qualsiasi richiesta a /admin e
// /api/admin, e aggiunge a ogni richiesta un token firmato. Qui controlliamo quel token:
// se per errore la regola di Access venisse tolta o sbagliata, l'admin resterebbe comunque chiuso.
//
// Il controllo è facoltativo e si attiva solo se nel progetto Pages (Settings → Variables)
// sono impostate due variabili:
//   ACCESS_TEAM_DOMAIN   es. "bargniff.cloudflareaccess.com"
//   ACCESS_AUD           l'"Application Audience (AUD) Tag" dell'applicazione Access
// Se mancano, il controllo è spento e funziona tutto come prima.

const KEYS_CACHE_MS = 60 * 60 * 1000;
let cachedKeys = null;

function decodeBase64Url(value) {
	const base64 = value
		.replace(/-/g, "+")
		.replace(/_/g, "/")
		.padEnd(Math.ceil(value.length / 4) * 4, "=");
	return Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
}

function decodeJson(value) {
	return JSON.parse(new TextDecoder().decode(decodeBase64Url(value)));
}

async function fetchAccessKeys(teamDomain) {
	if (
		cachedKeys &&
		cachedKeys.teamDomain === teamDomain &&
		Date.now() - cachedKeys.at < KEYS_CACHE_MS
	) {
		return cachedKeys.keys;
	}

	const response = await fetch(`https://${teamDomain}/cdn-cgi/access/certs`);
	if (!response.ok) throw new Error("Chiavi di Access non disponibili");

	const { keys } = await response.json();
	cachedKeys = { teamDomain, keys, at: Date.now() };
	return keys;
}

// Verifica firma, destinatario (aud), emittente e scadenza. Restituisce i dati del token o solleva un errore.
export async function verifyAccessToken(token, { teamDomain, audience, keys, now = Date.now() }) {
	const parts = String(token || "").split(".");
	if (parts.length !== 3) throw new Error("Token non valido");

	const [headerPart, payloadPart, signaturePart] = parts;
	const header = decodeJson(headerPart);
	const payload = decodeJson(payloadPart);

	if (header.alg !== "RS256") throw new Error("Algoritmo non ammesso");

	const jwk = keys.find((key) => key.kid === header.kid);
	if (!jwk) throw new Error("Chiave sconosciuta");

	const publicKey = await crypto.subtle.importKey(
		"jwk",
		jwk,
		{ name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
		false,
		["verify"],
	);

	const signedData = new TextEncoder().encode(`${headerPart}.${payloadPart}`);
	const isValid = await crypto.subtle.verify(
		"RSASSA-PKCS1-v1_5",
		publicKey,
		decodeBase64Url(signaturePart),
		signedData,
	);
	if (!isValid) throw new Error("Firma non valida");

	const audiences = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
	if (!audiences.includes(audience)) throw new Error("Destinatario errato");
	if (payload.iss !== `https://${teamDomain}`) throw new Error("Emittente errato");

	const seconds = Math.floor(now / 1000);
	if (typeof payload.exp !== "number" || payload.exp <= seconds) throw new Error("Token scaduto");
	if (typeof payload.nbf === "number" && payload.nbf > seconds + 60)
		throw new Error("Token non ancora valido");

	return payload;
}

// Middleware per le cartelle /admin e /api/admin.
export async function guardAdminArea(context) {
	const { request, env } = context;
	const teamDomain = env.ACCESS_TEAM_DOMAIN;
	const audience = env.ACCESS_AUD;

	if (!teamDomain || !audience) return context.next(); // controllo non attivato

	try {
		const token = request.headers.get("cf-access-jwt-assertion");
		await verifyAccessToken(token, {
			teamDomain,
			audience,
			keys: await fetchAccessKeys(teamDomain),
		});
	} catch {
		return new Response("Accesso non autorizzato.", {
			status: 403,
			headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" },
		});
	}

	return context.next();
}
