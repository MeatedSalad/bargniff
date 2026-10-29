// Pagine HTML generate dal server: articolo, archivio e "non trovato".
// Lo stile sta in assets/css (article.css e pages.css): qui c'è solo la struttura.

import { esc, formatDate } from "./text.js";

const CONTACTS = {
	instagram: "@bargniff.pavia",
	mail: "bargniff.pavia@proton.me",
	facebook: "Creativo Bargniff",
};

const MONTH_NAMES = [
	"Gennaio",
	"Febbraio",
	"Marzo",
	"Aprile",
	"Maggio",
	"Giugno",
	"Luglio",
	"Agosto",
	"Settembre",
	"Ottobre",
	"Novembre",
	"Dicembre",
];

const TONES = ["tone0", "tone1", "tone2"];
const FROGS = ["/assets/rana-crema.png", "/assets/rana-verde.png", "/assets/rana-marrone.png"];

function linkSups(html) {
	return html.replace(
		/<sup data-fn="(\d+)">\d*<\/sup>/g,
		'<sup class="fn"><a href="#nota-$1">$1</a></sup>',
	);
}

function linkify(escaped) {
	return escaped.replace(/\bhttps?:\/\/[^\s<]+/g, (url) => {
		const tail = (/[.,;:!?)]+$/.exec(url) || [""])[0];
		const clean = tail ? url.slice(0, -tail.length) : url;
		return `<a href="${clean}" target="_blank" rel="noopener noreferrer">${clean}</a>${tail}`;
	});
}

function renderBlocks(a) {
	const blocks = Array.isArray(a.blocks) ? a.blocks : [];
	const dateline =
		a.showDateline === false ? "" : [a.place, formatDate(a.date)].filter(Boolean).join(", ");
	const firstIsText = blocks[0] && blocks[0].type === "p";
	const parts = [];
	let datelineDone = false;

	if (dateline && !firstIsText) {
		parts.push(`<p class="dateline">${esc(dateline)}</p>`);
		datelineDone = true;
	}

	for (const b of blocks) {
		if (b.type === "p") {
			let html = linkSups(b.html || "");
			if (dateline && !datelineDone) {
				html = `${esc(dateline)} - ${html}`;
				datelineDone = true;
			}
			parts.push(`<p>${html}</p>`);
		} else if (b.type === "h") {
			parts.push(`<h2 class="sub">${b.html || ""}</h2>`);
		} else if (b.type === "q") {
			parts.push(`<blockquote class="pull">${linkSups(b.html || "")}</blockquote>`);
		} else if (b.type === "hr") {
			parts.push("<hr>");
		} else if (b.type === "img") {
			const layout = ["full", "center", "left", "right"].includes(b.layout) ? b.layout : "full";
			parts.push(
				`<figure class="fig fig-${layout}"><img src="/api/img/${esc(b.src)}" alt="${esc(b.alt)}" decoding="async">` +
					(b.caption ? `<figcaption>${esc(b.caption)}</figcaption>` : "") +
					"</figure>",
			);
		}
	}

	if (a.signature) parts.push(`<p class="signature">${esc(a.signature)}</p>`);

	const notes = (Array.isArray(a.notes) ? a.notes : [])
		.map((text, i) =>
			text
				? `<p class="note" id="nota-${i + 1}"><sup>${i + 1}</sup> ${linkify(esc(text))}</p>`
				: "",
		)
		.join("");
	if (notes) parts.push(`<section class="notes">${notes}</section>`);

	return parts.join("\n");
}

// Parte comune a tutte le pagine: titolo, anteprime per i social, icona e fogli di stile.
function head({ title, description, image, noindex, stylesheet }) {
	return `<!doctype html>
<html lang="it">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light only">
<title>${esc(title)}</title>
${description ? `<meta name="description" content="${esc(description)}">` : ""}
<meta property="og:site_name" content="Bargniff Pavia">
<meta property="og:title" content="${esc(title)}">
${description ? `<meta property="og:description" content="${esc(description)}">` : ""}
${image ? `<meta property="og:image" content="${esc(image)}">` : ""}
${noindex ? '<meta name="robots" content="noindex, nofollow">' : ""}
<link rel="icon" type="image/png" href="/assets/rana-crema.png?v=1">
<link rel="stylesheet" href="/assets/css/fonts.css">
<link rel="stylesheet" href="/assets/css/${stylesheet}">
</head>`;
}

export function renderArticle(article, { origin = "", preview = false } = {}) {
	const title = article.title || "Articolo";
	const image = article.cover ? `${origin}/api/img/${article.cover}` : "";
	const status = article.status === "published" ? "pubblicato" : "bozza (non visibile al pubblico)";

	return `${head({ title: `${title} · Bargniff Pavia`, description: article.excerpt, image, noindex: preview, stylesheet: "article.css" })}
<body>
<div class="bar no-print">
  <a href="/">← Torna al sito</a>
  <button type="button" id="print-button">Stampa / Salva PDF</button>
</div>
${preview ? `<div class="preview-banner no-print">Anteprima · stato: ${status}</div>` : ""}
<main class="paper">
<table class="sheet">
<thead><tr><td>
  <div class="mast"><a class="brand" href="/">Bargniff Pavia</a><img src="/assets/rana-marrone.png" alt=""></div>
</td></tr></thead>
<tbody><tr><td>
  <article class="art">
    <h1 class="title">${esc(title)}</h1>
    ${article.subtitle ? `<p class="subtitle">${esc(article.subtitle)}</p>` : ""}
    ${article.author ? `<p class="byline">di ${esc(article.author)}</p>` : ""}
    ${renderBlocks(article)}
  </article>
</td></tr></tbody>
<tfoot><tr><td>
  <footer class="contacts">
    <span>Ig: ${esc(CONTACTS.instagram)}</span>
    <span>Mail: <a href="mailto:${esc(CONTACTS.mail)}">${esc(CONTACTS.mail)}</a></span>
    <span>Fb: ${esc(CONTACTS.facebook)}</span>
  </footer>
</td></tr></tfoot>
</table>
</main>
<script src="/assets/js/print.js" defer></script>
</body>
</html>`;
}

// Raggruppa gli articoli per anno e, dentro ogni anno, per mese (l'elenco arriva già dal più recente).
function groupByYearAndMonth(articles) {
	const years = new Map();

	for (const article of articles) {
		const match = /^(\d{4})-(\d{2})/.exec(article.date || "");
		const year = match ? match[1] : "Senza data";
		const month = match ? Number(match[2]) : 0;

		if (!years.has(year)) years.set(year, new Map());
		const months = years.get(year);
		if (!months.has(month)) months.set(month, []);
		months.get(month).push(article);
	}

	return years;
}

export function renderArchive(articles) {
	const years = groupByYearAndMonth(articles);
	const anchorOf = (year) => `anno-${esc(year.replace(/\s+/g, "-"))}`;

	// Le schede si alternano a sinistra e a destra della linea del tempo.
	let cardNumber = 0;
	const renderCard = (article) => {
		const i = cardNumber++;
		const side = i % 2 === 0 ? "l" : "r";
		const visual = article.cover
			? `<img class="cover" src="/api/img/${esc(article.cover)}" alt="" loading="lazy" decoding="async">`
			: `<span class="icon"><img src="${FROGS[i % FROGS.length]}" alt=""></span>`;

		return `
      <li class="post ${side}" style="--i:${i}">
        <span class="dot" aria-hidden="true"></span>
        <a class="card ${TONES[i % TONES.length]}" href="/articolo/${esc(article.id)}">
          ${visual}
          <time datetime="${esc(article.date)}">${esc(formatDate(article.date))}</time>
          <h3>${esc(article.title)}</h3>
          ${article.excerpt ? `<p>${esc(article.excerpt)}</p>` : ""}
          <span class="more">Leggi l'articolo →</span>
        </a>
      </li>`;
	};

	const yearLinks = [...years]
		.map(([year, months]) => {
			const count = [...months.values()].reduce((sum, list) => sum + list.length, 0);
			return `<a href="#${anchorOf(year)}">${esc(year)} <b>${count}</b></a>`;
		})
		.join("");

	const yearSections = [...years]
		.map(
			([year, months]) => `
    <section>
      <h2 class="year" id="${anchorOf(year)}"><span>${esc(year)}</span></h2>
      ${[...months]
				.map(
					([month, items]) => `
        ${month ? `<h3 class="month"><span>${MONTH_NAMES[month - 1]}</span></h3>` : ""}
        <ol class="posts">${items.map(renderCard).join("")}</ol>`,
				)
				.join("")}
    </section>`,
		)
		.join("");

	const total = articles.length;
	const countText = total === 1 ? "1 articolo" : `${total} articoli`;

	const content = total
		? `<nav class="years" aria-label="Vai all'anno">${yearLinks}</nav>
<main class="timeline">
  ${yearSections}
  <div class="end"><p>Siamo arrivati in fondo al laghetto!</p></div>
</main>`
		: `<main class="timeline timeline--empty">
  <div class="empty"><h2>Il laghetto è ancora silenzioso</h2><p>Presto qui troverai tutti gli articoli del Bargniff.</p></div>
</main>`;

	return `${head({ title: "Articoli · Bargniff Pavia", description: "Tutti gli articoli del Bargniff, in ordine di tempo", stylesheet: "pages.css" })}
<body>
<header class="site"><a href="/"><img src="/assets/rana-crema.png" alt="">Bargniff</a></header>
<section class="hero">
  <h1>Tutti i nostri articoli</h1>
  ${total ? `<span class="count">${countText}</span>` : ""}
  <svg class="wave" viewBox="0 0 1440 70" preserveAspectRatio="none" aria-hidden="true"><path d="M0 40 C 180 0, 360 0, 540 30 S 900 70, 1080 35 S 1340 5, 1440 30 L1440 70 L0 70 Z"/></svg>
</section>
${content}
<div class="foot"><a class="back" href="/">← Torna alla home</a></div>
</body>
</html>`;
}

export function renderNotFound() {
	return `${head({ title: "Pagina non trovata · Bargniff Pavia", noindex: true, stylesheet: "pages.css" })}
<body>
<header class="site"><a href="/"><img src="/assets/rana-crema.png" alt="">Bargniff</a></header>
<main class="page">
  <h1>Articolo non trovato</h1>
  <p>L'articolo che cerchi non esiste o non è più disponibile.</p>
  <a class="back" href="/">← Torna al sito</a>
</main>
</body>
</html>`;
}
