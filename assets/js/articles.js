// Sezione "Articoli" della home: mostra gli ultimi 3 articoli pubblicati dall'admin.
// Se non ce ne sono, la sezione resta nascosta.
// Sugli schermi stretti le schede si scorrono di lato; due frecce compaiono solo
// quando c'è davvero qualcosa da vedere a sinistra o a destra.

const MAX_ON_HOME = 3;
const FALLBACK_ICONS = [
	"/assets/rana-marrone.png",
	"/assets/rana-crema.png",
	"/assets/rana-verde.png",
];

export async function setupArticles() {
	const section = document.querySelector("#articoli");
	const grid = document.querySelector("#articles-grid");
	const allArticlesLink = document.querySelector("#articles-all");
	const scroller = document.querySelector("#articles-scroller");

	try {
		const response = await fetch("/api/articles");
		if (!response.ok) throw new Error("Risposta non valida");

		const articles = await response.json();
		if (!Array.isArray(articles) || articles.length === 0) return;

		grid.replaceChildren(...articles.slice(0, MAX_ON_HOME).map(createArticleCard));
		allArticlesLink.hidden = articles.length <= MAX_ON_HOME;
		section.hidden = false;
		setupArrows(scroller, grid);
	} catch {
		// Senza articoli (o con la rete che non risponde) la sezione resta nascosta.
	}
}

function formatDate(isoDate) {
	const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate || "");
	if (!match) return "";

	const [, year, month, day] = match;
	return new Date(+year, +month - 1, +day).toLocaleDateString("it-IT", {
		day: "numeric",
		month: "long",
		year: "numeric",
	});
}

function createElement(tag, className, text) {
	const element = document.createElement(tag);
	if (className) element.className = className;
	if (text) element.textContent = text;
	return element;
}

function createImage(src) {
	const image = document.createElement("img");
	image.src = src;
	image.alt = "";
	image.loading = "lazy";
	image.decoding = "async";
	return image;
}

function createArticleCard(article, index) {
	const card = createElement("a", "why-card art-card");
	card.href = `/articolo/${encodeURIComponent(article.id)}`;

	if (article.cover) {
		const cover = createElement("div", "art-cover");
		cover.append(createImage(`/api/img/${encodeURIComponent(article.cover)}`));
		card.append(cover);
	} else {
		// Senza copertina usiamo una delle rane come icona.
		const icon = createElement("div", "why-icon");
		icon.append(createImage(FALLBACK_ICONS[index % FALLBACK_ICONS.length]));
		card.append(icon);
	}

	card.append(
		createElement("span", "art-date", formatDate(article.date)),
		createElement("h3", "", article.title),
	);

	if (article.excerpt) card.append(createElement("p", "", article.excerpt));
	card.append(createElement("span", "art-more", "Leggi l'articolo →"));

	return card;
}

/* ---------- frecce per scorrere le schede ---------- */

function setupArrows(scroller, grid) {
	const previous = scroller.querySelector(".scroller-arrow--prev");
	const next = scroller.querySelector(".scroller-arrow--next");

	// Ogni freccia compare solo se da quella parte c'è ancora qualcosa da vedere.
	function updateArrows() {
		const maxScroll = grid.scrollWidth - grid.clientWidth;
		previous.hidden = grid.scrollLeft <= 1;
		next.hidden = maxScroll <= 1 || grid.scrollLeft >= maxScroll - 1;
	}

	function scrollByCard(direction) {
		const card = grid.firstElementChild;
		const gap = parseFloat(getComputedStyle(grid).columnGap) || 0;
		const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

		grid.scrollBy({
			left: direction * (card.offsetWidth + gap),
			behavior: reduceMotion ? "auto" : "smooth",
		});
	}

	previous.addEventListener("click", () => scrollByCard(-1));
	next.addEventListener("click", () => scrollByCard(1));
	grid.addEventListener("scroll", updateArrows, { passive: true });
	new ResizeObserver(updateArrows).observe(grid);

	updateArrows();
}
