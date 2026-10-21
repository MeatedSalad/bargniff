// Sezione Instagram della home. I post si scelgono dall'admin e arrivano da /api/instagram.
//
// Ogni post può comparire in due modi:
//  - se dall'admin è stata caricata una foto di anteprima, mostriamo una nostra scheda
//    (veloce, e non fa nessuna richiesta a Instagram);
//  - altrimenti il post viene incorporato da Instagram, come sempre, mentre un riquadro
//    di caricamento tiene il posto finché non è pronto.

const EMBED_SCRIPT_URL = "https://www.instagram.com/embed.js";
const EMBED_TIMEOUT_MS = 20_000;
const SECOND_BATCH_DELAY_MS = 3_000;

const section = document.querySelector("#instagram");
const grid = document.querySelector("#instagram-grid");

export async function setupInstagram() {
	removeObsoleteStorage();

	const posts = await fetchPosts();
	if (posts.length === 0) return; // niente post: la sezione resta nascosta e non occupa spazio

	grid.replaceChildren(...posts.map(createPostCard));
	section.hidden = false;

	embedPosts([...grid.querySelectorAll(".post-card--embed")]);
}

/* ---------- dati ---------- */

async function fetchPosts() {
	try {
		const response = await fetch("/api/instagram");
		if (!response.ok) return [];

		const list = await response.json();
		return Array.isArray(list) ? list.map(normalizePost).filter(Boolean).slice(0, 3) : [];
	} catch {
		return [];
	}
}

// Accetta sia il formato vecchio (solo il link) sia quello nuovo (oggetto con foto e testo).
function normalizePost(item) {
	const post = typeof item === "string" ? { url: item } : item;
	if (!post || typeof post.url !== "string" || !post.url.startsWith("https://www.instagram.com/")) {
		return null;
	}

	return { url: post.url, image: post.image || "", caption: post.caption || "" };
}

// Le versioni precedenti del sito salvavano nel browser alcune informazioni: non servono più.
function removeObsoleteStorage() {
	try {
		localStorage.removeItem("bargniff:instagram");
		localStorage.removeItem("bargniff:instagram-consent");
	} catch {
		// Niente da ripulire.
	}
}

/* ---------- schede dei post ---------- */

function createPostCard(post) {
	return post.image ? createPhotoCard(post) : createEmbedCard(post.url);
}

function createLink(url, className) {
	const link = document.createElement("a");
	link.className = className;
	link.href = url;
	link.target = "_blank";
	link.rel = "noopener noreferrer";
	return link;
}

function createTextElement(tag, className, text) {
	const element = document.createElement(tag);
	element.className = className;
	element.textContent = text;
	return element;
}

// Scheda con la nostra foto: tutto arriva dal nostro sito.
function createPhotoCard(post) {
	const card = createLink(post.url, "post-card");

	const image = document.createElement("img");
	image.src = `/api/img/${encodeURIComponent(post.image)}`;
	image.alt = post.caption || "Un nostro post su Instagram";
	image.loading = "lazy";
	image.decoding = "async";

	const body = document.createElement("div");
	body.className = "post-card-body";
	body.append(createTextElement("span", "post-badge", "Instagram"));
	if (post.caption) body.append(createTextElement("p", "post-caption", post.caption));
	body.append(createTextElement("span", "post-link", "Vedi il post →"));

	card.append(image, body);
	return card;
}

// Scheda che verrà riempita dal post incorporato; nel frattempo mostra lo scheletro di caricamento.
function createEmbedCard(url) {
	const card = document.createElement("div");
	card.className = "post-card post-card--embed is-loading";
	card.dataset.url = url;

	const skeleton = document.createElement("div");
	skeleton.className = "insta-skeleton";
	skeleton.setAttribute("aria-hidden", "true");
	skeleton.innerHTML =
		'<div class="insta-skeleton-head"><i></i><div><i></i><i></i></div></div>' +
		'<i class="insta-skeleton-media"></i><i></i><i></i>';

	card.append(skeleton);
	return card;
}

// Se il post incorporato non parte (rete lenta, estensioni che bloccano Instagram)
// resta almeno un riquadro con il link.
function showLinkInstead(card) {
	const link = createLink(card.dataset.url, "post-card post-card--plain");
	link.append(
		createTextElement("span", "post-badge", "Instagram"),
		createTextElement("p", "post-caption", "Un nostro post su Instagram"),
		createTextElement("span", "post-link", "Apri su Instagram →"),
	);
	card.replaceWith(link);
}

/* ---------- post incorporati ---------- */

let embedScriptPromise = null;

function loadEmbedScript() {
	if (!embedScriptPromise) {
		embedScriptPromise = new Promise((resolve, reject) => {
			const script = document.createElement("script");
			script.async = true;
			script.src = EMBED_SCRIPT_URL;
			script.onload = resolve;
			script.onerror = reject;
			document.head.appendChild(script);
		});
	}
	return embedScriptPromise;
}

function processEmbeds() {
	if (window.instgrm) window.instgrm.Embeds.process();
}

async function embedPosts(cards) {
	if (cards.length === 0) return;

	try {
		await loadEmbedScript();
	} catch {
		cards.forEach(showLinkInstead);
		return;
	}

	// Il primo post parte da solo e quindi compare prima; gli altri partono quando è pronto
	// (o dopo pochi secondi), così non si contendono la stessa connessione.
	const [first, ...others] = cards;
	const startOthers = () => others.forEach(startEmbed);

	startEmbed(first).then(startOthers);
	setTimeout(startOthers, SECOND_BATCH_DELAY_MS);
}

// Aggiunge il post vero dentro la scheda e aspetta che Instagram lo disegni.
function startEmbed(card) {
	if (card.dataset.started) return Promise.resolve();
	card.dataset.started = "yes";

	const quote = document.createElement("blockquote");
	quote.className = "instagram-media";
	quote.setAttribute("data-instgrm-permalink", card.dataset.url);
	quote.setAttribute("data-instgrm-version", "14");
	card.append(quote);

	processEmbeds();
	return waitUntilRendered(card);
}

function waitUntilRendered(card) {
	return new Promise((resolve) => {
		let timer;

		const finish = () => {
			observer.disconnect();
			clearTimeout(timer);
			card.classList.remove("is-loading");
			resolve();
		};

		// Instagram inserisce un iframe nella scheda e, quando ha finito, gli aggiunge una classe.
		const observer = new MutationObserver(() => {
			const frame = card.querySelector("iframe");
			if (!frame) return;

			if (frame.classList.contains("instagram-media-rendered")) finish();
			else frame.addEventListener("load", finish, { once: true });
		});
		observer.observe(card, {
			childList: true,
			subtree: true,
			attributes: true,
			attributeFilter: ["class"],
		});

		timer = setTimeout(() => {
			if (card.querySelector("iframe")) {
				finish();
			} else {
				observer.disconnect();
				showLinkInstead(card);
				resolve();
			}
		}, EMBED_TIMEOUT_MS);
	});
}
