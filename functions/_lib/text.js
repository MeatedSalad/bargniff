// Funzioni per trattare il testo: escape dell'HTML, date in italiano, pulizia del testo degli articoli.

const MONTHS = [
	"gennaio",
	"febbraio",
	"marzo",
	"aprile",
	"maggio",
	"giugno",
	"luglio",
	"agosto",
	"settembre",
	"ottobre",
	"novembre",
	"dicembre",
];

export function esc(value) {
	return String(value ?? "").replace(
		/[&<>"']/g,
		(c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
	);
}

export function formatDate(iso) {
	const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || "");
	if (!m) return "";
	return `${Number(m[3])} ${MONTHS[Number(m[2]) - 1] || ""} ${m[1]}`;
}

export function slugify(title) {
	const slug = String(title || "")
		.normalize("NFD")
		.replace(/[\u0300-\u036f]/g, "")
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, 60)
		.replace(/-+$/, "");
	return slug || "articolo";
}

export function plainText(html) {
	return String(html || "")
		.replace(/<[^>]*>/g, " ")
		.replace(/&nbsp;/g, " ")
		.replace(/&lt;/g, "<")
		.replace(/&gt;/g, ">")
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'")
		.replace(/&amp;/g, "&")
		.replace(/[\u200B]/g, "")
		.replace(/\s+/g, " ")
		.trim();
}

function fixText(text) {
	return text
		.replace(/\u200B/g, "")
		.replace(/&nbsp;/g, " ")
		.replace(/&(?!(?:amp|lt|gt|quot|#39|nbsp|#\d{1,6}|#x[0-9a-f]{1,6});)/gi, "&amp;")
		.replace(/>/g, "&gt;");
}

// Tiene solo grassetto, corsivo, link http(s)/mailto, a capo e numeri di nota.
// Tutto il resto (script, attributi, stili...) viene scartato.
export function sanitizeInline(input, { allowSup = true } = {}) {
	const src = String(input ?? "").slice(0, 30000);
	const out = [];
	const stack = [];
	let skipSup = false;
	const re = /<(\/?)([a-zA-Z][a-zA-Z0-9]*)\b([^>]*)>|([^<]+)|</g;
	let m;

	while ((m = re.exec(src)) !== null) {
		if (m[4] !== undefined) {
			if (!skipSup) out.push(fixText(m[4]));
			continue;
		}
		if (m[2] === undefined) {
			if (!skipSup) out.push("&lt;");
			continue;
		}

		const closing = m[1] === "/";
		const name = m[2].toLowerCase();
		const attrs = m[3] || "";

		if (name === "sup") {
			if (closing) {
				skipSup = false;
				continue;
			}
			if (!allowSup || skipSup) continue;
			const n = /data-fn\s*=\s*["']?(\d{1,3})/i.exec(attrs);
			if (n) {
				out.push(`<sup data-fn="${Number(n[1])}">${Number(n[1])}</sup>`);
				skipSup = true;
			}
			continue;
		}
		if (skipSup) continue;

		if (name === "br") {
			if (!closing) out.push("<br>");
			continue;
		}

		const tag =
			name === "b" || name === "strong"
				? "strong"
				: name === "i" || name === "em"
					? "em"
					: name === "a"
						? "a"
						: null;
		if (!tag) continue;

		if (closing) {
			const i = stack.lastIndexOf(tag);
			if (i === -1) continue;
			while (stack.length > i) out.push(`</${stack.pop()}>`);
			continue;
		}

		if (tag === "a") {
			if (stack.includes("a")) continue;
			const h = /href\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i.exec(attrs);
			const href = (h ? (h[1] ?? h[2] ?? h[3] ?? "") : "").replace(/&amp;/g, "&").trim();
			if (!/^(https?:\/\/|mailto:)[^\s<>"']{1,2000}$/i.test(href)) continue;
			out.push(`<a href="${esc(href)}" target="_blank" rel="noopener noreferrer">`);
			stack.push("a");
			continue;
		}

		out.push(`<${tag}>`);
		stack.push(tag);
	}

	while (stack.length) out.push(`</${stack.pop()}>`);
	return out.join("");
}
