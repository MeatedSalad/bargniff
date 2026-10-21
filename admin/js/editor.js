// Editor degli articoli: titolo e dati, testo a blocchi (paragrafi, titoli, foto, citazioni),
// note a piè di pagina, copertina, salvataggio e pubblicazione.

import { $, $$, api, sendJson, toast, todayISO } from "./util.js";
import { pickFile, uploadImage } from "./image-upload.js";

/* ---------- editor: stato ---------- */

const state = { id: null, dirty: false, saving: false, status: "draft" };

// Il resto dell'admin (main.js) ci dice cosa fare quando l'editor si apre o si chiude.
const hooks = { onOpen() {}, onClose() {} };
let isOpen = false;

export function setupEditor(newHooks) {
	Object.assign(hooks, newHooks);
}

export function isEditorOpen() {
	return isOpen;
}

// Chiude l'editor; se ci sono modifiche non salvate chiede conferma. Restituisce true se si è chiuso.
export function requestCloseEditor() {
	if (!isOpen) return true;
	if (state.dirty && !confirm("Hai modifiche non salvate. Vuoi uscire senza salvare?"))
		return false;

	isOpen = false;
	state.dirty = false;
	hooks.onClose();
	return true;
}

function markDirty() {
	if (!state.dirty) {
		state.dirty = true;
		const el = $("#save-state");
		el.textContent = "Modifiche non salvate";
		el.classList.add("dirty");
	}
}

function applyStatusUi() {
	const published = state.status === "published";
	const badge = $("#status-badge");
	badge.textContent = published ? "Pubblicato" : "Bozza";
	badge.className = "badge " + (published ? "pub" : "draft");
	$("#btn-publish").textContent = published ? "Aggiorna articolo" : "Pubblica";
	$("#btn-draft").textContent = published ? "Metti in bozza" : "Salva bozza";
	const live = $("#link-live");
	live.hidden = !(published && state.id);
	if (state.id) live.href = "/articolo/" + encodeURIComponent(state.id);
}

function markSaved() {
	state.dirty = false;
	const el = $("#save-state");
	el.textContent =
		"Salvato alle " +
		new Date().toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });
	el.classList.remove("dirty");
}

window.addEventListener("beforeunload", (event) => {
	if (isOpen && state.dirty) {
		event.preventDefault();
		event.returnValue = "";
	}
});

export async function openEditor(id) {
	let article = {
		title: "",
		subtitle: "",
		author: "",
		place: "Pavia",
		signature: "Bargniff Pavia",
		date: todayISO(),
		status: "draft",
		showDateline: true,
		cover: "",
		blocks: [{ type: "p", html: "" }],
		notes: [],
	};

	if (id) {
		try {
			article = await api("/api/admin/articles?id=" + encodeURIComponent(id), {
				cache: "no-store",
			});
		} catch (error) {
			toast(error.message, true);
			return;
		}
	}

	state.id = id || null;
	$("#f-title").value = article.title || "";
	$("#f-subtitle").value = article.subtitle || "";
	$("#f-author").value = article.author || "";
	$("#f-place").value = article.place || "";
	$("#f-signature").value = article.signature || "";
	$("#f-date").value = article.date || todayISO();
	state.status = article.status === "published" ? "published" : "draft";
	applyStatusUi();
	$("#f-dateline").checked = article.showDateline !== false;
	setCover(article.cover || "");

	const blocksEl = $("#blocks");
	blocksEl.replaceChildren(
		...(article.blocks && article.blocks.length ? article.blocks : [{ type: "p", html: "" }]).map(
			createBlock,
		),
	);
	renderNotes(article.notes || []);
	$("#btn-delete").hidden = !id;

	state.dirty = false;
	$("#save-state").textContent = id ? "" : "Nuovo articolo";
	$("#save-state").classList.remove("dirty");

	isOpen = true;
	hooks.onOpen();
	window.scrollTo(0, 0);
	updateFormatToolbar();
}

$("#btn-back").addEventListener("click", requestCloseEditor);

[
	"#f-title",
	"#f-subtitle",
	"#f-author",
	"#f-place",
	"#f-signature",
	"#f-date",
	"#f-dateline",
].forEach((sel) => $(sel).addEventListener("input", markDirty));

/* ---------- editor: blocchi ---------- */

const PLACEHOLDERS = {
	p: "Scrivi qui il testo…",
	h: "Titolo di sezione",
	q: "Scrivi qui la citazione…",
};

function toolButton(act, label, title) {
	const b = document.createElement("button");
	b.type = "button";
	b.dataset.act = act;
	b.textContent = label;
	b.title = title;
	return b;
}

function normalizeHtml(html) {
	const tmp = document.createElement("div");
	tmp.innerHTML = html || "";
	$$("sup[data-fn]", tmp).forEach((sup) => {
		sup.textContent = sup.dataset.fn;
		sup.setAttribute("contenteditable", "false");
	});
	return tmp.innerHTML;
}

function createBlock(data) {
	const block = document.createElement("div");
	block.className = "blk";
	block.dataset.type = data.type;

	const tools = document.createElement("div");
	tools.className = "blk-tools";
	tools.append(
		toolButton("up", "↑", "Sposta su"),
		toolButton("down", "↓", "Sposta giù"),
		toolButton("add", "＋", "Inserisci sotto"),
		toolButton("del", "✕", "Elimina"),
	);
	block.append(tools);

	if (data.type === "hr") {
		block.append(document.createElement("hr"));
	} else if (data.type === "img") {
		block.dataset.src = data.src || "";
		block.dataset.layout = ["full", "center", "left", "right"].includes(data.layout)
			? data.layout
			: "full";
		block.dataset.alt = data.alt || "";
		tools.prepend(...imageTools());
		block.append(buildImageBlock(data));
		paintStage(block);
		syncLayoutButtons(block);
	} else {
		const ed = document.createElement("div");
		ed.className = "ed ed-" + data.type;
		ed.contentEditable = "true";
		ed.spellcheck = true;
		ed.lang = "it";
		ed.dataset.ph = PLACEHOLDERS[data.type] || "";
		ed.innerHTML = normalizeHtml(data.html);
		block.append(ed);
	}
	return block;
}

const LAYOUT_BUTTONS = [
	["full", "Intera", "Foto a tutta larghezza"],
	["center", "Centrata", "Foto centrata, più piccola"],
	["left", "Sinistra", "Foto a sinistra: il testo scorre accanto"],
	["right", "Destra", "Foto a destra: il testo scorre accanto"],
];

function imageTools() {
	const buttons = LAYOUT_BUTTONS.map(([name, label, title]) => {
		const b = toolButton("lay-" + name, label, title);
		b.classList.add("txt");
		return b;
	});
	const alt = toolButton("alt", "Descrizione", "Descrivi la foto per chi non la vede");
	const replace = toolButton("replace", "Cambia foto", "Sostituisci la foto");
	alt.classList.add("txt");
	replace.classList.add("txt");
	const sep = document.createElement("span");
	sep.className = "sep";
	return [...buttons, alt, replace, sep];
}

function syncLayoutButtons(block) {
	$$(".blk-tools [data-act^=lay-]", block).forEach((b) =>
		b.classList.toggle("on", b.dataset.act === "lay-" + block.dataset.layout),
	);
}

function buildImageBlock(data) {
	const figure = document.createElement("figure");
	figure.className = "imgblk";

	const stage = document.createElement("div");
	stage.className = "img-stage";
	const caption = document.createElement("input");
	caption.className = "img-caption";
	caption.maxLength = 400;
	caption.placeholder = "Didascalia (facoltativa)";
	caption.value = data.caption || "";
	caption.addEventListener("input", markDirty);

	figure.append(stage, caption);
	return figure;
}

function paintStage(block) {
	const stage = $(".img-stage", block);
	stage.replaceChildren();

	if (block.dataset.src) {
		const img = document.createElement("img");
		img.src = "/api/img/" + block.dataset.src;
		img.alt = "";
		stage.append(img);
	} else {
		const pick = document.createElement("button");
		pick.type = "button";
		pick.className = "pick";
		pick.textContent = "＋ Scegli una foto…";
		pick.onclick = () => chooseImageFor(block);
		stage.append(pick);
	}
}

async function chooseImageFor(block) {
	const file = await pickFile();
	if (!file) return;

	const stage = $(".img-stage", block);
	stage.replaceChildren(
		Object.assign(document.createElement("span"), {
			className: "busy",
			textContent: "Carico la foto…",
		}),
	);
	try {
		const { id } = await uploadImage(file);
		block.dataset.src = id;
		markDirty();
	} catch (error) {
		toast(error.message, true);
	}
	paintStage(block);
}

/* inserimento / spostamento / eliminazione */

function blocksEl() {
	return $("#blocks");
}

async function insertBlock(type, after) {
	const block = createBlock({ type, html: "", layout: "full" });
	if (after) after.after(block);
	else blocksEl().append(block);
	markDirty();

	if (type === "img") await chooseImageFor(block);
	const ed = $(".ed", block);
	if (ed) focusEditable(ed, true);
	block.scrollIntoView({ block: "nearest", behavior: "smooth" });
	return block;
}

function focusEditable(el, atStart) {
	el.focus();
	const range = document.createRange();
	range.selectNodeContents(el);
	range.collapse(atStart);
	const sel = getSelection();
	sel.removeAllRanges();
	sel.addRange(range);
}

blocksEl().addEventListener("click", (event) => {
	const button = event.target.closest(".blk-tools button");
	if (!button) return;
	const block = button.closest(".blk");
	const act = button.dataset.act;

	if (act.startsWith("lay-")) {
		block.dataset.layout = act.slice(4);
		syncLayoutButtons(block);
	} else if (act === "alt") {
		const value = prompt(
			"Descrivi la foto per chi non può vederla (facoltativo):",
			block.dataset.alt || "",
		);
		if (value === null) return;
		block.dataset.alt = value.trim();
	} else if (act === "replace") {
		chooseImageFor(block);
		return;
	} else if (act === "up" && block.previousElementSibling)
		block.previousElementSibling.before(block);
	else if (act === "down" && block.nextElementSibling) block.nextElementSibling.after(block);
	else if (act === "add") return openMenu(button, (type) => insertBlock(type, block));
	else if (act === "del") {
		const ed = $(".ed", block);
		const empty = ed && !ed.textContent.trim();
		if (!empty && !confirm("Eliminare questo blocco?")) return;
		block.remove();
		if (!blocksEl().children.length) blocksEl().append(createBlock({ type: "p", html: "" }));
	}
	markDirty();
});

$$(".addbar [data-add]").forEach((b) =>
	b.addEventListener("click", () => insertBlock(b.dataset.add, null)),
);

/* menu a comparsa */

function openMenu(anchor, onPick) {
	const menu = $("#menu");
	const items = [
		["p", "Paragrafo"],
		["h", "Titolo di sezione"],
		["img", "Foto"],
		["q", "Citazione"],
		["hr", "Separatore"],
	];
	menu.replaceChildren(
		...items.map(([type, label]) => {
			const b = document.createElement("button");
			b.type = "button";
			b.textContent = label;
			b.onclick = () => {
				closeMenu();
				onPick(type);
			};
			return b;
		}),
	);
	const rect = anchor.getBoundingClientRect();
	menu.hidden = false;
	menu.style.top = rect.bottom + window.scrollY + 6 + "px";
	menu.style.left =
		Math.max(8, Math.min(rect.left + window.scrollX - 150, window.innerWidth - 210)) + "px";
}

function closeMenu() {
	$("#menu").hidden = true;
}
document.addEventListener("mousedown", (e) => {
	if (!e.target.closest("#menu") && !e.target.closest("[data-act=add]")) closeMenu();
});
document.addEventListener("keydown", (e) => {
	if (e.key === "Escape") closeMenu();
});

/* tastiera e incolla dentro i blocchi di testo */

function cleanHtml(html) {
	return html
		.replace(/\u200B/g, "")
		.replace(/(<br\s*\/?>\s*)+$/i, "")
		.trim();
}

blocksEl().addEventListener("input", (event) => {
	const ed = event.target.closest(".ed");
	if (ed && (ed.innerHTML === "<br>" || ed.innerHTML === "<div><br></div>")) ed.innerHTML = "";
	markDirty();
});

blocksEl().addEventListener("keydown", (event) => {
	const ed = event.target.closest && event.target.closest(".ed");
	if (!ed) return;

	if (event.key === "Enter" && !event.shiftKey) {
		event.preventDefault();
		splitBlock(ed);
	} else if (event.key === "Backspace" && !ed.textContent && blocksEl().children.length > 1) {
		event.preventDefault();
		const block = ed.closest(".blk");
		const prev =
			$(".ed", block.previousElementSibling || document.createElement("i")) ||
			$(".ed", block.nextElementSibling || document.createElement("i"));
		block.remove();
		if (prev) focusEditable(prev, false);
		markDirty();
	}
});

function splitBlock(ed) {
	const sel = getSelection();
	if (!sel.rangeCount) return;
	const range = sel.getRangeAt(0);
	range.deleteContents();

	const tail = document.createRange();
	tail.selectNodeContents(ed);
	tail.setStart(range.endContainer, range.endOffset);
	const holder = document.createElement("div");
	holder.appendChild(tail.extractContents());

	const next = createBlock({ type: "p", html: cleanHtml(holder.innerHTML) });
	ed.closest(".blk").after(next);
	if (ed.innerHTML === "<br>") ed.innerHTML = "";
	focusEditable($(".ed", next), true);
	markDirty();
}

blocksEl().addEventListener("paste", (event) => {
	const ed = event.target.closest && event.target.closest(".ed");
	if (!ed) return;
	event.preventDefault();

	const text = (event.clipboardData || window.clipboardData)
		.getData("text/plain")
		.replace(/\r/g, "");
	const parts = text
		.split(/\n{2,}/)
		.map((p) => p.replace(/\s*\n\s*/g, " ").trim())
		.filter(Boolean);
	if (!parts.length) return;

	document.execCommand("insertText", false, parts[0]);

	let anchor = ed.closest(".blk");
	parts.slice(1).forEach((part) => {
		const block = createBlock({ type: "p", html: "" });
		$(".ed", block).textContent = part;
		anchor.after(block);
		anchor = block;
	});
	if (parts.length > 1) focusEditable($(".ed", anchor), false);
	markDirty();
});

/* barra di formattazione */

function activeEditable() {
	const sel = getSelection();
	if (!sel.rangeCount) return null;
	const node =
		sel.anchorNode &&
		(sel.anchorNode.nodeType === 1 ? sel.anchorNode : sel.anchorNode.parentElement);
	const ed = node && node.closest && node.closest(".ed");
	return ed && blocksEl().contains(ed) ? ed : null;
}

function updateFormatToolbar() {
	const ed = activeEditable();
	$$("#fmt button").forEach((b) => {
		b.disabled = !ed;
	});
	if (ed && ed.classList.contains("ed-h"))
		$$("#fmt [data-cmd=note]").forEach((b) => {
			b.disabled = true;
		});
}
document.addEventListener("selectionchange", updateFormatToolbar);

$("#fmt").addEventListener("mousedown", (e) => e.preventDefault());
$("#fmt").addEventListener("click", (event) => {
	const button = event.target.closest("button");
	if (!button || button.disabled) return;
	const ed = activeEditable();
	if (!ed) return;
	const cmd = button.dataset.cmd;

	if (cmd === "bold" || cmd === "italic" || cmd === "unlink") {
		document.execCommand(cmd, false, null);
	} else if (cmd === "link") {
		const sel = getSelection();
		const saved = sel.getRangeAt(0).cloneRange();
		if (saved.collapsed)
			return toast("Prima seleziona la parola o la frase da trasformare in link.");
		let url = prompt("Indirizzo del link (ad esempio https://…)");
		if (!url) return;
		url = url.trim();
		if (!/^(https?:\/\/|mailto:)/i.test(url)) url = "https://" + url;
		sel.removeAllRanges();
		sel.addRange(saved);
		document.execCommand("createLink", false, url);
	} else if (cmd === "note") {
		const used = $$("sup[data-fn]", blocksEl()).map((s) => Number(s.dataset.fn));
		const n = (used.length ? Math.max(...used) : 0) + 1;
		document.execCommand(
			"insertHTML",
			false,
			`<sup data-fn="${n}" contenteditable="false">${n}</sup>&#8203;`,
		);
		ensureNotes(n);
	}
	markDirty();
});

/* ---------- note ---------- */

function noteRow(number, text) {
	const row = document.createElement("div");
	row.className = "note-row";
	const label = document.createElement("b");
	label.textContent = number;
	const area = document.createElement("textarea");
	area.maxLength = 600;
	area.placeholder = "Testo della nota o link alla fonte";
	area.value = text || "";
	area.addEventListener("input", markDirty);
	const del = document.createElement("button");
	del.type = "button";
	del.className = "btn small ghost";
	del.textContent = "✕";
	del.title = "Elimina questa nota";
	del.onclick = () => {
		row.remove();
		refreshNoteButtons();
		markDirty();
	};
	row.append(label, area, del);
	return row;
}

function refreshNoteButtons() {
	const rows = $$(".note-row");
	rows.forEach((row, i) => {
		row.firstChild.textContent = i + 1;
		row.lastChild.hidden = i !== rows.length - 1;
	});
}

function renderNotes(notes) {
	$("#notes").replaceChildren(...notes.map((t, i) => noteRow(i + 1, t)));
	refreshNoteButtons();
}

function ensureNotes(count) {
	const box = $("#notes");
	while ($$(".note-row").length < count) box.append(noteRow(0, ""));
	refreshNoteButtons();
	const row = $$(".note-row")[count - 1];
	if (row) {
		row.classList.add("flash");
		setTimeout(() => row.classList.remove("flash"), 1600);
	}
}

$("#btn-add-note").addEventListener("click", () => {
	ensureNotes($$(".note-row").length + 1);
	markDirty();
});

/* ---------- copertina ---------- */

let coverId = "";

function setCover(id) {
	coverId = id || "";
	const img = $("#cover-img");
	img.hidden = !coverId;
	if (coverId) img.src = "/api/img/" + coverId;
	$("#btn-cover-del").hidden = !coverId;
	$("#btn-cover").textContent = coverId ? "Cambia foto…" : "Scegli foto…";
}

$("#btn-cover").addEventListener("click", async () => {
	const file = await pickFile();
	if (!file) return;
	$("#cover-state").textContent = "Carico…";
	try {
		const { id } = await uploadImage(file);
		setCover(id);
		markDirty();
	} catch (error) {
		toast(error.message, true);
	}
	$("#cover-state").textContent = "";
});

$("#btn-cover-del").addEventListener("click", () => {
	setCover("");
	markDirty();
});

/* ---------- salvataggio ---------- */

function collectArticle(status) {
	const blocks = $$(".blk", blocksEl())
		.map((el) => {
			const type = el.dataset.type;
			if (type === "hr") return { type };
			if (type === "img") {
				return {
					type,
					src: el.dataset.src || "",
					layout: el.dataset.layout || "full",
					caption: $(".img-caption", el).value,
					alt: el.dataset.alt || "",
				};
			}
			return { type, html: cleanHtml($(".ed", el).innerHTML) };
		})
		.filter((b) => b.type !== "img" || b.src);

	return {
		id: state.id,
		title: $("#f-title").value,
		subtitle: $("#f-subtitle").value,
		author: $("#f-author").value,
		place: $("#f-place").value,
		signature: $("#f-signature").value,
		date: $("#f-date").value,
		status: status || state.status,
		showDateline: $("#f-dateline").checked,
		cover: coverId,
		blocks,
		notes: $$(".note-row textarea").map((t) => t.value),
	};
}

async function save(status) {
	if (state.saving) return null;
	state.saving = true;
	$("#btn-publish").disabled = true;
	$("#btn-draft").disabled = true;
	$("#save-state").textContent = "Salvataggio…";
	try {
		const result = await sendJson("/api/admin/articles", "POST", collectArticle(status));
		state.id = result.id;
		state.status = status || state.status;
		$("#btn-delete").hidden = false;
		applyStatusUi();
		markSaved();
		return result;
	} catch (error) {
		$("#save-state").textContent = "Non salvato";
		toast(error.message, true);
		return null;
	} finally {
		state.saving = false;
		$("#btn-publish").disabled = false;
		$("#btn-draft").disabled = false;
	}
}

$("#btn-publish").addEventListener("click", async () => {
	const wasPublished = state.status === "published";
	const result = await save("published");
	if (result)
		toast(wasPublished ? "Articolo aggiornato sul sito." : "Pubblicato! Ora è online sul sito.");
});

$("#btn-draft").addEventListener("click", async () => {
	if (state.status === "published") {
		if (!confirm("L'articolo non sarà più visibile sul sito. Vuoi metterlo in bozza?")) return;
		const result = await save("draft");
		if (result) toast("Ora è una bozza: non è più visibile sul sito.");
	} else {
		const result = await save("draft");
		if (result) toast("Bozza salvata.");
	}
});

$("#btn-preview").addEventListener("click", async () => {
	const tab = window.open("", "_blank");
	const result = await save();
	if (result && tab) tab.location = "/admin/preview/" + encodeURIComponent(result.id);
	else if (tab) tab.close();
});

$("#btn-delete").addEventListener("click", async () => {
	if (!state.id) return;
	if (!confirm("Eliminare definitivamente questo articolo e le sue foto?")) return;
	try {
		await sendJson("/api/admin/articles", "DELETE", { id: state.id });
		state.dirty = false;
		isOpen = false;
		toast("Articolo eliminato.");
		hooks.onClose();
	} catch (error) {
		toast(error.message, true);
	}
});

document.addEventListener("keydown", (event) => {
	if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s" && isOpen) {
		event.preventDefault();
		save().then((result) => {
			if (result) toast("Salvato.");
		});
	}
});
