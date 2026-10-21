// Punto di ingresso dell'admin: collega le tre viste (elenco articoli, editor, post Instagram).

import { $, $$ } from "./util.js";
import { loadArticleList, setupArticleList } from "./articles-list.js";
import { isEditorOpen, openEditor, setupEditor } from "./editor.js";
import { setupBackup } from "./backup.js";
import { loadInstagramPosts, setupInstagramTab } from "./instagram-tab.js";

const views = {
	list: $("#view-list"),
	editor: $("#view-editor"),
	instagram: $("#view-instagram"),
};

function showView(name) {
	for (const [viewName, element] of Object.entries(views)) element.hidden = viewName !== name;

	const tab = name === "instagram" ? "instagram" : "articles";
	$$(".tabs button").forEach((button) => button.classList.toggle("on", button.dataset.tab === tab));
}

setupArticleList({ onEdit: openEditor });

setupEditor({
	onOpen: () => showView("editor"),
	onClose: () => {
		showView("list");
		loadArticleList();
	},
});

setupInstagramTab();
setupBackup();

// Cambiare scheda non fa perdere il lavoro: l'editor resta com'è e si riapre tornando su "Articoli".
$$(".tabs button").forEach((button) => {
	button.addEventListener("click", () => {
		if (button.dataset.tab === "instagram") {
			showView("instagram");
			loadInstagramPosts();
		} else if (isEditorOpen()) {
			showView("editor");
		} else {
			showView("list");
			loadArticleList();
		}
	});
});

loadArticleList();
