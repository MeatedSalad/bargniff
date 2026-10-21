// Popup semplici, basati sull'elemento <dialog> del browser.
// Si aprono con openPopup("nome") e si chiudono con il pulsante, con Esc o cliccando fuori.

const popups = {
	construction: document.querySelector("#construction-popup"),
};

export function openPopup(name) {
	popups[name]?.showModal();
}

export function setupPopups() {
	for (const dialog of Object.values(popups)) {
		if (!dialog) continue;

		dialog.querySelector("[data-close-popup]")?.addEventListener("click", () => dialog.close());

		// Un click sullo sfondo scuro (cioè sul <dialog> stesso, fuori dal riquadro) chiude il popup.
		dialog.addEventListener("click", (event) => {
			if (event.target === dialog) dialog.close();
		});
	}
}
