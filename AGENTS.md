# AGENTS.md — esmaTEX Website

> Projektsprache (UI, Kommentare, Doku): **Deutsch**. Verbindliche Faktenquelle für
> Firmenstammdaten, Design-Tokens und Kontrastregeln ist `requirements.md`.
> Bei Widerspruch zwischen Doku und Config/Skript gilt die ausführbare Quelle.

## Projekt

Statisches Astro-5-Onepager (`/`, Anker-Navigation) + `/impressum`, `/datenschutz`.
Build erzeugt genau **3 HTML-Seiten**. Kein Test-Framework, kein Linter, keine CI.

## Befehle

- `npm run dev` (alias `npm start`) — Dev-Server
- `npm run build` — Prod-Build nach `dist/`
- `npm run check` (= `astro check`) — Typ- und Template-Prüfung
- **Vor jedem Abschluss: `npm run check` (0 Fehler/0 Warnungen) + `npm run build` (Exit 0).**
- Kontaktformular lokal: `.env` aus `.env.example` anlegen (`PUBLIC_WEB3FORMS_KEY`).

## Content-Architektur (wichtigster Aspekt)

- Texte stehen **nie** in Komponenten: `src/content/site.json` (Firma, Nav/Footer, `ui.cookieBanner`)
  + `src/content/pages/*.json` (`index` | `impressum` | `datenschutz`).
- Schemas in `src/content.config.ts` (diskriminierte Union über `page`).
  **Neue Content-Struktur zuerst dort als Zod-Schema abbilden**, sonst schlägt der Build fehl.
- Props-Typen aus Collections ableiten, nicht neu definieren:
  `Extract<CollectionEntry<'pages'>['data'], { page: 'index' }>`.
- Datenfluss: nur `Layout.astro`/Seiten laden Collections per `getEntry`
  (`index.astro` reicht Sektions-Objekte als Props weiter); Sektions-Komponenten nehmen nur Props.
- CMS-ready: jede Sektion `data-cms-section="<id>"`, jeder editierbare Text/jedes Bild
  `data-cms-field="<json-pfad>"` (z. B. `form.serviceOptions.2`). **`src/content/cms.manifest.json`
  bei jeder Content-Änderung mitpflegen** (Eintrag mit `id, label, type, file, path, maxLength`).

## Konventionen

- Farben nur als Token-Klassen: `primary`, `primary-dark`, `ink`, `surface`, `muted`, `subtle`
  (RGB-Triplets in `src/styles/global.css`, gemappt in `tailwind.config.mjs`); Fonts nur
  `font-heading` / `font-body`. Keine Hex-Farben erfinden.
- Kontrast (WCAG 2.2 AA, verbindlich): auf `bg-primary` (`#41A9E6`) nur `text-ink`,
  nie Weiß; Text-Links auf Weiß nur `text-primary-dark` (`#1F72A6`).
  Fokus-Ringe sind global in `global.css` definiert — nicht entfernen.
- `src/scripts/scroll-animate.js` muss **reines JS** bleiben (kein TS): sonst Runtime-Fehler
  und `[data-animate]`-Elemente bleiben bei `opacity: 0` unsichtbar. Versteck-Regeln greifen
  nur unter `.js`-Klasse auf `<html>` (No-JS-Fallback); `prefers-reduced-motion` respektieren.
  Animation per `data-animate`, Staggering per `data-animate-delay="<ms>"`.
- FAQ-Akkordeon: natives `<details>/<summary>`. Deko-Elemente `aria-hidden`.
- Komponentenskripte: `<script>` (Astro bündelt, TS ok); `<script is:inline>` nur für
  Head-Skripte im Layout.

## Deployment & DSGVO-Gotchas

- `vercel.json`: CSP `frame-ancestors 'self' http://localhost:* https://*.vercel.app` für
  CMS-Iframe-Preview — **kein `X-Frame-Options: DENY` setzen**. CSP sonst nicht ohne Grund ändern
  (`img-src` inkl. `https://*.supabase.co`, `connect-src` inkl. `https://api.web3forms.com`).
- Redirects in `vercel.json` behalten: `/kontakt` → `/#kontakt`, `/blog/*` → `/`
  (Blog/Kontaktseite wurden in Update v2 entfernt — nicht wieder einführen).
- Formular (`ContactForm.astro`): Web3Forms-POST ohne Reload, Honeypot-Feld `botcheck` behalten.
  `PUBLIC_WEB3FORMS_KEY` ist absichtlich öffentlich; keine echten Secrets ins Repo.
- Cookie-Banner: localStorage-Key `esmatex-consent`, Event `esma:consent`, Texte aus `site.json`.
- Fonts 100 % lokal (`src/assets/fonts/*.woff2`, Preload im Layout) — keine Google-Fonts/CDN-Calls.

## Stammdaten (nicht raten, nicht ändern)

esmaTEX · Inh. Ümmü Kaman · USt-IdNr. DE353978752 · Bahnhofstr. 65, 31655 Stadthagen ·
Tel. 05721 898882 (`tel:+495721898882`) · info@esmatex.de ·
Partner: Sport Wilkening (https://sport-wilkening.de/).
Öffnungszeiten/Testimonials sind Platzhalter (vor Launch ersetzen — UWG);
Showcase-Bilder in `public/images/` sind noch SVGs.
