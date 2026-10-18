// Funzioni condivise: escape, pulizia del testo e pagine HTML di articoli e archivio.

const MONTHS = [
  "gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno",
  "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre",
];

const CONTACTS = {
  instagram: "@bargniff.pavia",
  mail: "bargniff.pavia@proton.me",
  facebook: "Creativo Bargniff",
};

export function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (c) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
  ));
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
      if (closing) { skipSup = false; continue; }
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

    const tag = name === "b" || name === "strong" ? "strong"
      : name === "i" || name === "em" ? "em"
      : name === "a" ? "a"
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

function linkSups(html) {
  return html.replace(/<sup data-fn="(\d+)">\d*<\/sup>/g, '<sup class="fn"><a href="#nota-$1">$1</a></sup>');
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
  const dateline = a.showDateline === false ? "" : [a.place, formatDate(a.date)].filter(Boolean).join(", ");
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
        "</figure>"
      );
    }
  }

  if (a.signature) parts.push(`<p class="signature">${esc(a.signature)}</p>`);

  const notes = (Array.isArray(a.notes) ? a.notes : [])
    .map((text, i) => (text ? `<p class="note" id="nota-${i + 1}"><sup>${i + 1}</sup> ${linkify(esc(text))}</p>` : ""))
    .join("");
  if (notes) parts.push(`<section class="notes">${notes}</section>`);

  return parts.join("\n");
}

const FONTS =
  '<link rel="preconnect" href="https://fonts.googleapis.com">' +
  '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>' +
  '<link href="https://fonts.googleapis.com/css2?family=Fredoka:wght@600;700&display=swap" rel="stylesheet">';

const ARCHIVE_FONTS =
  '<link rel="preconnect" href="https://fonts.googleapis.com">' +
  '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>' +
  '<link href="https://fonts.googleapis.com/css2?family=Fredoka:wght@500;600;700&family=Raleway:wght@400;500;600;700&family=Caveat:wght@600;700&display=swap" rel="stylesheet">';

const ARTICLE_CSS = `
:root{--olive:#98992b;--red:#e1141c;--ink:#1c1c1c;--brown:#432f2c;--cream:#fbf9e1}
*{box-sizing:border-box}
html{-webkit-print-color-adjust:exact;print-color-adjust:exact}
body{margin:0;background:#ebe7d3;color:var(--ink);font-family:Calibri,Carlito,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;font-size:17px;line-height:1.55;-webkit-font-smoothing:antialiased}
.bar{position:sticky;top:0;z-index:5;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 20px;background:var(--brown);color:var(--cream)}
.bar a{color:inherit;font-weight:600;text-decoration:none}
.bar button{padding:8px 16px;border:0;border-radius:99px;background:#17fc96;color:var(--brown);font:700 15px/1 inherit;font-family:inherit;cursor:pointer}
.preview-banner{padding:8px 16px;background:#c8a627;color:var(--brown);text-align:center;font-weight:700}
.paper{max-width:880px;margin:26px auto 60px;padding:36px 56px 30px;background:#fff;box-shadow:0 20px 44px -24px rgba(0,0,0,.5)}
table.sheet{width:100%;border-collapse:collapse;border-spacing:0}
table.sheet>thead>tr>td,table.sheet>tbody>tr>td,table.sheet>tfoot>tr>td{padding:0;vertical-align:top}
.mast{position:relative;padding:4px 0 24px;text-align:center}
.mast .brand{display:inline-block;padding:0 10px 8px;border-bottom:2px solid var(--olive);color:var(--olive);font:700 38px/1.1 Fredoka,"Segoe UI",Arial,sans-serif;text-decoration:none}
.mast img{position:absolute;right:0;top:-6px;width:auto;height:84px}
.title{margin:6px 0 20px;color:var(--red);font-size:1.5rem;line-height:1.3;font-weight:700;text-align:center;text-transform:uppercase}
.subtitle{margin:-8px 0 20px;color:#444;font-size:1.1rem;font-style:italic;text-align:center}
.byline{margin:-8px 0 20px;color:#555;text-align:center}
.art p{margin:0 0 14px;text-align:justify;hyphens:auto}
.art strong{font-weight:700}
.art a{color:#2d6a7a}
.art .sub{margin:26px 0 10px;font-size:1.2rem;line-height:1.3;font-weight:700}
.art .pull{margin:22px 30px;padding:2px 0 2px 18px;border-left:3px solid var(--olive);font-size:1.15rem;font-style:italic;font-weight:600}
.art hr{margin:26px 0;border:0;border-top:1px solid #ccc}
.fig{margin:20px 0}
.fig img{display:block;width:100%;height:auto}
.fig figcaption{margin-top:6px;color:#555;font-size:.82rem;line-height:1.4}
.fig-center{width:64%;margin-left:auto;margin-right:auto}
.fig-left{float:left;width:46%;margin:6px 24px 12px 0}
.fig-right{float:right;width:46%;margin:6px 0 12px 24px}
.art::after{content:"";display:table;clear:both}
.art .signature{margin-top:44px;font-style:italic;text-align:right}
.notes{margin-top:40px}
.notes::before{content:"";display:block;width:32%;margin-bottom:8px;border-top:1px solid #222}
.art .note{margin:0 0 2px;font-size:.8rem;line-height:1.4;text-align:left;hyphens:none}
.note a{word-break:break-all}
sup.fn a{color:inherit;text-decoration:none}
.contacts{display:grid;grid-template-columns:1fr auto 1fr;gap:12px;margin-top:34px;padding-top:10px;color:var(--olive);font-size:.78rem;font-weight:700}
.contacts span:nth-child(2){text-align:center}
.contacts span:last-child{text-align:right}
.contacts a{color:inherit;text-decoration:underline}
@page{size:A4;margin:14mm 17mm 12mm}
@media print{
  body{background:#fff;font-size:11.5pt;line-height:1.45}
  .no-print{display:none!important}
  .paper{max-width:none;margin:0;padding:0;box-shadow:none}
  table.sheet{height:266mm}
  table.sheet>tbody>tr>td{height:100%}
  table.sheet>thead>tr>td,table.sheet>tfoot>tr>td{height:1px}
  thead{display:table-header-group}
  tfoot{display:table-footer-group}
  .mast{padding-bottom:18px}
  .mast .brand{font-size:26pt}
  .mast img{height:22mm}
  .title{font-size:15pt}
  .fig,.pull,.note{break-inside:avoid}
  .title,.sub{break-after:avoid}
  .art p{orphans:3;widows:3}
}
@media (max-width:640px){
  .paper{margin:0 0 40px;padding:22px 18px}
  .mast .brand{font-size:26px}
  .mast img{height:54px}
  .fig-left,.fig-right,.fig-center{float:none;width:100%;margin:16px 0}
  .art .pull{margin:18px 6px}
  .contacts{grid-template-columns:1fr}
  .contacts span{text-align:center!important}
}
`;

function head({ title, description, image, noindex, extraCss, fonts = FONTS }) {
  return `<!doctype html>
<html lang="it">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
${description ? `<meta name="description" content="${esc(description)}">` : ""}
<meta property="og:site_name" content="Bargniff Pavia">
<meta property="og:title" content="${esc(title)}">
${description ? `<meta property="og:description" content="${esc(description)}">` : ""}
${image ? `<meta property="og:image" content="${esc(image)}">` : ""}
${noindex ? '<meta name="robots" content="noindex, nofollow">' : ""}
<link rel="icon" type="image/png" href="/assets/rana-crema.png?v=1">
${fonts}
<style>${extraCss}</style>
</head>`;
}

export function renderArticle(a, { origin = "", preview = false } = {}) {
  const title = a.title || "Articolo";
  const image = a.cover ? `${origin}/api/img/${a.cover}` : "";
  const body = renderBlocks(a);

  return `${head({ title: `${title} · Bargniff Pavia`, description: a.excerpt, image, noindex: preview, extraCss: ARTICLE_CSS })}
<body>
<div class="bar no-print">
  <a href="/">← Torna al sito</a>
  <button type="button" onclick="window.print()">Stampa / Salva PDF</button>
</div>
${preview ? `<div class="preview-banner no-print">Anteprima · stato: ${a.status === "published" ? "pubblicato" : "bozza (non visibile al pubblico)"}</div>` : ""}
<main class="paper">
<table class="sheet">
<thead><tr><td>
  <div class="mast"><a class="brand" href="/">Bargniff Pavia</a><img src="/assets/rana-marrone.png" alt=""></div>
</td></tr></thead>
<tbody><tr><td>
  <article class="art">
    <h1 class="title">${esc(title)}</h1>
    ${a.subtitle ? `<p class="subtitle">${esc(a.subtitle)}</p>` : ""}
    ${a.author ? `<p class="byline">di ${esc(a.author)}</p>` : ""}
    ${body}
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
</body>
</html>`;
}

const SIMPLE_CSS = `
:root{--brown:#432f2c;--cream:#fbf9e1;--forest:#06754d;--gold:#c8a627}
*{box-sizing:border-box}
body{margin:0;background:var(--cream);color:var(--brown);font-family:Raleway,Calibri,"Segoe UI",Arial,sans-serif;line-height:1.6}
header{position:sticky;top:0;z-index:5;background:var(--brown);border-bottom:2px solid var(--gold)}
header a{display:flex;align-items:center;justify-content:center;gap:10px;padding:12px;color:var(--cream);font:700 1.5rem Fredoka,"Segoe UI",Arial,sans-serif;text-decoration:none}
header img{width:38px;height:38px;object-fit:contain}
main{max-width:860px;margin:0 auto;padding:44px 24px 80px}
h1{margin:0 0 28px;color:var(--forest);font:700 clamp(2rem,5vw,2.8rem)/1.1 Fredoka,"Segoe UI",Arial,sans-serif}
.item{display:grid;grid-template-columns:200px 1fr;gap:22px;margin-bottom:26px;padding:22px;background:#fff8e6;border:1px solid rgba(67,47,44,.1);border-radius:22px;color:inherit;text-decoration:none;transition:transform .25s,box-shadow .25s}
.item:hover{transform:translateY(-4px);box-shadow:0 18px 40px -22px rgba(67,47,44,.5)}
.item.nocover{grid-template-columns:1fr}
.item img{width:100%;aspect-ratio:4/3;object-fit:cover;border-radius:14px}
.item time{color:var(--forest);font-size:.82rem;font-weight:700;letter-spacing:.05em;text-transform:uppercase}
.item h2{margin:4px 0 8px;font:600 1.35rem/1.2 Fredoka,"Segoe UI",Arial,sans-serif}
.item p{margin:0;color:rgba(67,47,44,.8)}
.empty{color:rgba(67,47,44,.7)}
a.back{display:inline-block;margin-top:10px;color:var(--forest);font-weight:700}
@media (max-width:600px){.item{grid-template-columns:1fr}}
`;

const MONTH_NAMES = [
  "Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno",
  "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre",
];

const ARCHIVE_CSS = `
:root{--brown:#432f2c;--cream:#fbf9e1;--forest:#06754d;--gold:#c8a627;--mint:#17fc96;--ease:cubic-bezier(.22,.61,.36,1)}
*{box-sizing:border-box}
html{scroll-behavior:smooth;scroll-padding-top:130px;background:var(--cream)}
body{margin:0;background:var(--cream);color:var(--brown);font-family:Raleway,Calibri,"Segoe UI",Arial,sans-serif;line-height:1.6;overflow-x:hidden}
a{color:inherit}
header.site{position:sticky;top:0;z-index:30;background:var(--brown);border-bottom:2px solid var(--gold)}
header.site a{display:flex;align-items:center;justify-content:center;gap:10px;padding:12px;color:var(--cream);font:700 1.5rem Fredoka,"Segoe UI",Arial,sans-serif;text-decoration:none}
header.site img{width:38px;height:38px;object-fit:contain}

.hero{position:relative;padding:54px 24px 0;overflow:hidden;background:var(--brown);color:var(--cream);text-align:center}
.hero .eyebrow{margin:0 0 6px;color:var(--mint);font:700 1.5rem Caveat,cursive}
.hero h1{margin:0 auto;max-width:820px;font:600 clamp(2.3rem,6.5vw,4.2rem)/1.05 Fredoka,"Segoe UI",Arial,sans-serif}
.count{display:inline-block;margin-top:18px;padding:5px 16px;border-radius:99px;background:rgba(23,252,150,.16);color:var(--mint);font-weight:700}
@keyframes bob{0%,100%{transform:translateY(0) rotate(0)}50%{transform:translateY(-8px) rotate(-3deg)}}
.wave{display:block;width:calc(100% + 48px);max-width:none;height:70px;margin:26px 0 0 -24px}
.wave path{fill:var(--cream)}

nav.years{position:sticky;top:64px;z-index:20;display:flex;justify-content:center;flex-wrap:wrap;gap:8px;padding:12px 16px;background:rgba(251,249,225,.94);backdrop-filter:blur(6px)}
nav.years a{display:inline-flex;align-items:center;gap:8px;padding:6px 16px;border-radius:99px;background:#fff8e6;border:1px solid rgba(67,47,44,.14);font:600 1rem Fredoka,"Segoe UI",Arial,sans-serif;text-decoration:none;transition:transform .2s var(--ease),background .2s}
nav.years a:hover{background:var(--forest);color:var(--cream);transform:translateY(-2px)}
nav.years b{padding:0 8px;border-radius:99px;background:var(--gold);color:#3a2a10;font-size:.8rem}

main.timeline{position:relative;max-width:1000px;margin:0 auto;padding:0 24px 40px}
main.timeline::before{content:"";position:absolute;left:50%;top:0;bottom:30px;width:4px;margin-left:-2px;border-radius:4px;background:repeating-linear-gradient(to bottom,rgba(6,117,77,.38) 0 14px,transparent 14px 26px)}
.year{position:relative;z-index:2;display:flex;justify-content:center;align-items:center;gap:12px;margin:54px 0 14px}
.year span{padding:4px 30px 8px;border-radius:99px;background:var(--forest);color:var(--cream);font:700 clamp(2.2rem,6vw,3.4rem)/1 Fredoka,"Segoe UI",Arial,sans-serif;box-shadow:0 8px 0 -3px rgba(6,117,77,.28)}
.year small{display:none}
.month{position:relative;z-index:2;margin:34px 0 6px;text-align:center}
.month span{display:inline-block;padding:4px 18px;border-radius:99px;background:var(--gold);color:#3a2a10;font:600 1.05rem Fredoka,"Segoe UI",Arial,sans-serif;letter-spacing:.02em}
ol.posts{margin:0;padding:0;list-style:none}
.post{position:relative;width:50%;padding:14px 40px 14px 0;opacity:0;animation:rise .65s var(--ease) both;animation-delay:min(calc(var(--i) * 70ms),700ms)}
.post.r{margin-left:50%;padding:14px 0 14px 40px}
@keyframes rise{from{opacity:0;transform:translateY(22px)}to{opacity:1;transform:none}}
.post .dot{position:absolute;top:36px;right:-15px;width:30px;height:30px;border-radius:50%;background:radial-gradient(circle at 35% 30%,#5fbf65,#045c45 75%);box-shadow:0 0 0 5px var(--cream),0 0 0 7px rgba(6,117,77,.3)}
.post .dot::after{content:"";position:absolute;inset:9px;border-radius:50%;background:var(--mint)}
.post.r .dot{left:-15px;right:auto}
.card{display:block;overflow:hidden;padding:18px;border:1px solid rgba(67,47,44,.1);border-radius:26px;background:var(--tone);color:inherit;text-decoration:none;box-shadow:0 16px 30px -24px rgba(67,47,44,.7);transition:transform .3s var(--ease),box-shadow .3s var(--ease)}
.tone0{--tone:#fff8e6}.tone1{--tone:#e3f4ea}.tone2{--tone:#f7edc4}
.post.l .card{transform:rotate(-.7deg)}
.post.r .card{transform:rotate(.7deg)}
.card:hover,.card:focus-visible{transform:translateY(-7px) rotate(0);box-shadow:0 26px 40px -24px rgba(67,47,44,.75);outline:none}
.card:focus-visible{box-shadow:0 0 0 3px var(--forest)}
.card .cover{display:block;width:100%;aspect-ratio:16/10;margin-bottom:14px;object-fit:cover;border-radius:18px}
.card .icon{display:flex;align-items:center;justify-content:center;width:56px;height:56px;margin-bottom:12px;border-radius:16px;background:var(--brown)}
.card .icon img{width:68%}
.tone1 .icon{background:var(--forest)}
.tone2 .icon{background:#eadfb4}
.card time{display:inline-block;padding:3px 13px;border-radius:99px;background:var(--gold);color:#3a2a10;font-size:.78rem;font-weight:700;letter-spacing:.04em}
.card h3{margin:10px 0 6px;font:600 1.32rem/1.2 Fredoka,"Segoe UI",Arial,sans-serif}
.card p{margin:0;color:rgba(67,47,44,.8);font-size:.98rem}
.card .more{display:inline-block;margin-top:12px;color:var(--forest);font-weight:700}
.card:hover .more{text-decoration:underline}

.end{position:relative;z-index:2;display:flex;flex-direction:column;align-items:center;gap:6px;margin-top:34px;text-align:center}
.end img{width:64px;animation:bob 6s ease-in-out infinite}
.end p{margin:0;font:600 1.1rem Fredoka,"Segoe UI",Arial,sans-serif}
.empty{max-width:520px;margin:30px auto 80px;padding:34px 24px;border:2px dashed rgba(67,47,44,.25);border-radius:26px;text-align:center}
.empty img{width:80px}
a.back{display:inline-block;margin:6px 0 60px;padding:10px 24px;border-radius:99px;background:var(--mint);color:var(--brown);font-weight:700;text-decoration:none;transition:transform .25s var(--ease)}
a.back:hover{transform:translateY(-3px)}
.foot{padding:0 24px 50px;text-align:center}

@media (max-width:760px){
  main.timeline{padding:0 16px 30px}
  main.timeline::before{left:22px;margin-left:0}
  .year,.month{justify-content:flex-start;text-align:left;padding-left:0;margin-left:0}
  .year{margin-left:2px}
  .post,.post.r{width:100%;margin-left:0;padding:10px 0 10px 54px}
  .post .dot,.post.r .dot{left:7px;right:auto;top:32px}
  .post.l .card,.post.r .card{transform:none}
  nav.years{top:62px}
}
@media (prefers-reduced-motion:reduce){
  *,*::before,*::after{animation-duration:.001ms!important;animation-iteration-count:1!important;transition-duration:.001ms!important;scroll-behavior:auto!important}
  .post{opacity:1}
}
`;

const TONES = ["tone0", "tone1", "tone2"];
const FROGS = ["/assets/rana-crema.png", "/assets/rana-verde.png", "/assets/rana-marrone.png"];

export function renderArchive(list) {
  const years = new Map();
  for (const a of list) {
    const m = /^(\d{4})-(\d{2})/.exec(a.date || "");
    const year = m ? m[1] : "Senza data";
    const month = m ? Number(m[2]) : 0;
    if (!years.has(year)) years.set(year, new Map());
    const months = years.get(year);
    if (!months.has(month)) months.set(month, []);
    months.get(month).push(a);
  }

  let n = 0;
  const card = (a) => {
    const i = n++;
    const side = i % 2 === 0 ? "l" : "r";
    const visual = a.cover
      ? `<img class="cover" src="/api/img/${esc(a.cover)}" alt="" loading="lazy">`
      : `<span class="icon"><img src="${FROGS[i % FROGS.length]}" alt=""></span>`;
    return `
      <li class="post ${side}" style="--i:${i}">
        <span class="dot" aria-hidden="true"></span>
        <a class="card ${TONES[i % TONES.length]}" href="/articolo/${esc(a.id)}">
          ${visual}
          <time datetime="${esc(a.date)}">${esc(formatDate(a.date))}</time>
          <h3>${esc(a.title)}</h3>
          ${a.excerpt ? `<p>${esc(a.excerpt)}</p>` : ""}
          <span class="more">Leggi l'articolo →</span>
        </a>
      </li>`;
  };

  const chips = [...years].map(([year, months]) => {
    const count = [...months.values()].reduce((s, l) => s + l.length, 0);
    return `<a href="#anno-${esc(year.replace(/\s+/g, "-"))}">${esc(year)} <b>${count}</b></a>`;
  }).join("");

  const sections = [...years].map(([year, months]) => `
    <section>
      <h2 class="year" id="anno-${esc(year.replace(/\s+/g, "-"))}"><span>${esc(year)}</span></h2>
      ${[...months].map(([month, items]) => `
        ${month ? `<h3 class="month"><span>${MONTH_NAMES[month - 1]}</span></h3>` : ""}
        <ol class="posts">${items.map(card).join("")}</ol>`).join("")}
    </section>`).join("");

  const total = list.length;
  const countText = total === 1 ? "1 articolo" : `${total} articoli`;

  const body = total
    ? `${chips ? `<nav class="years" aria-label="Vai all'anno">${chips}</nav>` : ""}
<main class="timeline">
  ${sections}
  <div class="end"><img src="/assets/rana-verde.png" alt=""><p>Siamo arrivati in fondo al laghetto!</p></div>
</main>
<div class="foot"><a class="back" href="/">← Torna alla home</a></div>`
    : `<main class="timeline" style="padding-top:24px">
  <div class="empty"><img src="/assets/rana-verde.png" alt=""><h2 style="font-family:Fredoka,sans-serif">Il laghetto è ancora silenzioso</h2><p>Presto qui troverai tutti gli articoli del Bargniff.</p></div>
</main>
<div class="foot" style="text-align:center"><a class="back" href="/">← Torna alla home</a></div>`;

  return `${head({ title: "Articoli · Bargniff Pavia", description: "Tutti gli articoli del Bargniff, in ordine di tempo", extraCss: ARCHIVE_CSS, fonts: ARCHIVE_FONTS })}
<body>
<header class="site"><a href="/"><img src="/assets/rana-crema.png" alt="">Bargniff</a></header>
<section class="hero">
  <p class="eyebrow">Dal laghetto del Bargniff</p>
  <h1>Tutti i nostri articoli</h1>
  ${total ? `<span class="count">${countText}</span>` : ""}
  <svg class="wave" viewBox="0 0 1440 70" preserveAspectRatio="none" aria-hidden="true"><path d="M0 40 C 180 0, 360 0, 540 30 S 900 70, 1080 35 S 1340 5, 1440 30 L1440 70 L0 70 Z"/></svg>
</section>
${body}
</body>
</html>`;
}

export function renderNotFound() {
  return `${head({ title: "Pagina non trovata · Bargniff Pavia", noindex: true, extraCss: SIMPLE_CSS })}
<body>
<header><a href="/"><img src="/assets/rana-crema.png" alt="">Bargniff</a></header>
<main>
  <h1>Articolo non trovato</h1>
  <p class="empty">L'articolo che cerchi non esiste o non è più disponibile.</p>
  <a class="back" href="/">← Torna al sito</a>
</main>
</body>
</html>`;
}

export function htmlResponse(body, status = 200, cache = "no-store") {
  return new Response(body, {
    status,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": cache,
      "x-content-type-options": "nosniff",
      "referrer-policy": "strict-origin-when-cross-origin",
    },
  });
}
