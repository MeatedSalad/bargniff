// Il laghetto con le ninfee: passando sopra una ninfea (o selezionandola con la tastiera)
// il pannello di testo accanto cambia contenuto. Il click può anche fare qualcosa:
//   data-href    apre un'altra pagina
//   data-scroll  scorre fino a una parte della pagina (indicata da un selettore)
//   data-popup   apre un popup
//   (la ninfea "Donazione" scorre alla sezione delle donazioni)

import { openPopup } from "./popup.js";

export function setupPondPanel() {
	const panel = document.querySelector(".mission-info-panel");
	if (!panel) return;

	const eyebrow = panel.querySelector("[data-mission-eyebrow]");
	const title = panel.querySelector("[data-mission-title]");
	const copy = panel.querySelector("[data-mission-copy]");

	// Il testo iniziale è quello scritto nell'HTML: lo ricordiamo per poterlo ripristinare.
	const defaultText = {
		eyebrow: eyebrow.textContent.trim(),
		title: title.textContent.trim(),
		copy: copy.textContent.trim(),
	};

	function showLily(lily) {
		eyebrow.textContent = lily.dataset.eyebrow;
		title.textContent = lily.dataset.title;
		copy.textContent = lily.dataset.copy;
		panel.classList.add("is-active");
	}

	function resetPanel() {
		eyebrow.textContent = defaultText.eyebrow;
		title.textContent = defaultText.title;
		copy.textContent = defaultText.copy;
		panel.classList.remove("is-active");
	}

	for (const lily of document.querySelectorAll(".lily-trigger")) {
		lily.addEventListener("pointerenter", () => showLily(lily));
		lily.addEventListener("focus", () => showLily(lily));

		lily.addEventListener("click", () => {
			showLily(lily);

			// La ninfea "Donazione" scorre fino alla sezione delle donazioni.
			if (lily.classList.contains("donation-trigger")) {
				document
					.querySelector("#donazione")
					.scrollIntoView({ behavior: "smooth", block: "center" });
			}

			if (lily.dataset.scroll) {
				document
					.querySelector(lily.dataset.scroll)
					?.scrollIntoView({ behavior: "smooth", block: "start" });
			}

			if (lily.dataset.popup) openPopup(lily.dataset.popup);

			// La ninfea "Articoli" apre la pagina con tutti gli articoli.
			if (lily.dataset.href) window.location.href = lily.dataset.href;
		});

		lily.addEventListener("pointerleave", () => {
			if (document.activeElement !== lily) resetPanel();
		});
		lily.addEventListener("blur", resetPanel);
	}
}
