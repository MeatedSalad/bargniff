# Sito del Bargniff

Sito statico su Cloudflare Pages, con qualche funzione lato server (cartella `functions/`)
e un'area admin per scrivere gli articoli e scegliere i post Instagram.

## Dove sta cosa

```
index.html            la home (solo struttura: stile e script sono nei file qui sotto)
_headers              regole di sicurezza e cache per i file statici
robots.txt            cosa i motori di ricerca non devono indicizzare

assets/
  css/                fonts.css (font), site.css (home), pages.css (archivio), article.css (articoli)
  js/                 main.js avvia tutto; un file per ogni parte (onde, Instagram, articoli, laghetto...)
  fonts/              font del sito, serviti da qui (niente Google Fonts)

admin/                l'area riservata (protetta da Cloudflare Access)
  index.html          struttura
  admin.css           stile
  js/                 main.js, editor.js (articoli), instagram-tab.js, articles-list.js, ...

functions/            codice che gira sui server di Cloudflare
  api/                dati pubblici (/api/articles, /api/instagram, /api/img/...)
  api/admin/          operazioni riservate (salvare articoli, foto, post Instagram)
  articolo/, articoli/ pagine degli articoli e archivio
  admin/preview/      anteprima delle bozze
  _lib/               pezzi condivisi (testo, pagine, sicurezza)
```

## Provare il sito sul proprio computer

```
npx wrangler pages dev . --kv=BARGNIFF
```

Poi aprire http://localhost:8788 (il login di Cloudflare Access non c'è in locale).

## Pubblicare

```
git add .
git commit -m "Cosa hai cambiato"
git push
```

## Dove stanno articoli, foto e post

Articoli, foto e post Instagram sono salvati nell'archivio di Cloudflare (KV, collegato al progetto
con il nome `BARGNIFF`), separato dal codice: pubblicare un aggiornamento non li tocca.
Dall'admin (scheda Articoli, in fondo) si può scaricare una copia di sicurezza e ripristinarla.

## Seconda serratura per l'admin (facoltativa)

Cloudflare Access protegge già `/admin` e `/api/admin`. Per far controllare il login anche al
codice, nel progetto Pages (Settings → Variables and Secrets) aggiungi:

- `ACCESS_TEAM_DOMAIN` → il dominio del tuo team Zero Trust, ad esempio `nomeTeam.cloudflareaccess.com`
- `ACCESS_AUD` → l'«Application Audience (AUD) Tag» dell'applicazione Access dell'admin

Se le variabili non ci sono, il controllo è spento e tutto funziona come prima.
