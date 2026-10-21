// Punto di ingresso della home: avvia le varie parti del sito.

import { setupInstagram } from "./instagram.js";
import { setupArticles } from "./articles.js";
import { setupScrollReveal } from "./reveal.js";
import { setupPondPanel } from "./pond-panel.js";
import { setupPopups } from "./popup.js";
import { startWaves } from "./waves.js";

// Prima le richieste di rete, così le sezioni compaiono il prima possibile.
setupInstagram();
setupArticles();

setupScrollReveal();
setupPondPanel();
setupPopups();
startWaves({ pauseWhileHovering: document.querySelector("#instagram") });

// Ombra sotto l'header quando si scorre la pagina.
const header = document.querySelector("header");

window.addEventListener(
	"scroll",
	() => {
		header.style.boxShadow =
			window.scrollY > 12 ? "0 8px 24px -18px rgba(67, 47, 44, 0.5)" : "none";
	},
	{ passive: true },
);
