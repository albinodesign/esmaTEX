# esmaTEX — Requirements & Architektur-Dokument

> Website für **esmaTEX** (Inhaberin: Ümmü Kaman), Bahnhofstr. 65, 31655 Stadthagen.
> Slogan: „Qualität die überzeugt" · 100 % datenentkoppelt, CMS-ready, statisch generiert.

---

## 1. Tech-Stack

| Bereich | Technologie | Begründung |
|---|---|---|
| Framework | **Astro 5** (`output: 'static'`, SSG) | Maximale Performance, Zero-JS by default, Content Collections |
| Styling | **Tailwind CSS 3** (`@astrojs/tailwind`) | Utility-first, Design-Tokens via CSS-Variablen |
| Sprache | **TypeScript** (`strict: true`, `astro/tsconfigs/strict`) | Typsicherheit inkl. Zod-Content-Schemas |
| Content | `src/content/site.json`, `src/content/pages/*.json` | Zero Hardcoded Content — 100 % entkoppelt |
| Formulare | **Web3Forms** (Access-Key via `PUBLIC_WEB3FORMS_KEY`) | DSGVO-freundlich, kein eigenes Backend |
| Hosting | **Vercel** (`vercel.json` Security-Header) | Statisches Deployment, Iframe-fähige CMS-Preview |
| Bilder | `astro:assets` + Remote-Domain `*.supabase.co` | Optimierte lokale & CMS-Bilder |
| Fonts | Lokal (`src/assets/fonts/*.woff2`), `font-display: swap` | DSGVO: keine externen Font-Calls |
| Typo-Prüfung | `@astrojs/check` (`npx astro check`) | Qualitätsgate vor Build |

## 2. Design-Tokens

### Farben (CSS-Variablen als RGB-Triplets → `rgb(var(--token) / <alpha-value>)`)

| Token | Wert | Hex | Verwendung |
|---|---|---|---|
| `--color-primary` | `65 169 230` | `#41A9E6` | Brand Cyan-Blue: Akzente, Badges, Hover, Hintergrundflächen |
| `--color-primary-dark` | `31 114 166` | `#1F72A6` | Farbiger Fließtext/Links auf Weiß (Kontrast ≥ 4.5:1) |
| `--color-ink` | `15 23 42` | `#0F172A` | Primärtext, Text auf Brand-Buttons, Footer/Contrast-Sections |
| `--color-surface` | `255 255 255` | `#FFFFFF` | Flächen, Cards |
| `--color-muted` | `71 85 105` | `#475569` | Sekundärtext (auf Weiß ≥ 4.5:1) |
| `--color-bg-subtle` | `241 245 249` | `#F1F5F9` | Dezente Sektions-Hintergründe |

### WCAG-2.2-AA-Kontrastregeln (verbindlich)

- Auf `#41A9E6` (Buttons, Badges): **dunkler Text `#0F172A`** — weißer Kleintext ist wegen < 4.5:1 verboten.
- Farbige Text-Links auf Weiß: **`#2585BC`** (`primary-dark`), nicht `#41A9E6`.
- Fließtext: `#0F172A` auf Weiß (≈ 15:1); Sekundärtext `#475569` (≈ 7:1).
- Fokus-Ringe sichtbar (Tailwind `focus-visible`), interaktive Ziele ≥ 24×24 px.

### Typografie

| Rolle | Schrift | Format | Fallback |
|---|---|---|---|
| Headings | **Plus Jakarta Sans** (variabel) | `.woff2` lokal, `font-display: swap`, Preload | `ui-sans-serif, system-ui` |
| Body/UI | **Inter** (variabel) | `.woff2` lokal, `font-display: swap`, Preload | `ui-sans-serif, system-ui` |

Tailwind-Mapping: `font-heading`, `font-body`. Keine Google-Fonts-/CDN-Calls.

## 3. Iframe- & CMS-Preview-Architektur

- **Security-Header (`vercel.json`):** CSP mit `frame-ancestors 'self' http://localhost:* https://*.vercel.app;` — die Seite darf vom CMS (lokal & Vercel-Previews) per Iframe eingebettet werden. **Kein** `X-Frame-Options: DENY`.
- **CSP-Richtlinien:** `default-src 'self'`, `img-src 'self' data: blob: https://*.supabase.co`, `connect-src 'self' https://api.web3forms.com`, Fonts nur lokal/data.
- **Preview-Marker im Markup:**
  - Sektionen: `data-cms-section="[section-id]"`
  - Editierbare Elemente: `data-cms-field="[field-id]"`
- **Live-Preview-Bridge (`src/layouts/Layout.astro`):** `postMessage`-Listener nur aktiv, wenn `window.self !== window.top` (Iframe). Bei `CMS_FIELD_UPDATE` wird das Zielelement per `data-cms-field` gesucht und `innerText` (bzw. `src` bei `<img>`) aktualisiert.

## 4. CMS-Manifest-Mapping (`src/content/cms.manifest.json`)

`features.blog = false` (Blog wurde in Update v2 entfernt — reiner Onepager). Sektionen (jede mit Feldern `id, label, type, file, path, maxLength`):

| Manifest-Sektion | Datenquelle |
|---|---|
| Allgemeine Firmendaten | `src/content/site.json` |
| Startseite – Hero | `src/content/pages/index.json` |
| Startseite – Trust Counter | `src/content/pages/index.json` |
| Startseite – Leistungen (Übersicht & Detailkarten) | `src/content/pages/index.json` |
| Startseite – Partner (Sport Wilkening) | `src/content/pages/index.json` |
| Startseite – Verfahrensvergleich | `src/content/pages/index.json` |
| Startseite – Arbeitsweise (3 Schritte) | `src/content/pages/index.json` |
| Startseite – Portfolio / Showcase | `src/content/pages/index.json` |
| Startseite – Kundenstimmen | `src/content/pages/index.json` |
| Startseite – FAQ | `src/content/pages/index.json` |
| Startseite – Finaler Call to Action | `src/content/pages/index.json` |
| Startseite – Kontakt (Infos & Formular) | `src/content/pages/index.json` |
| Rechtliches – Impressum | `src/content/pages/impressum.json` |
| Rechtliches – Datenschutz | `src/content/pages/datenschutz.json` |

## 5. Verifizierte Stammdaten (einzige zulässige Faktenquelle)

- Unternehmen: **esmaTEX** · Inhaberin: **Ümmü Kaman** · Einzelunternehmen
- USt-IdNr.: **DE353978752**
- Adresse: **Bahnhofstr. 65, 31655 Stadthagen**
- Telefon: **05721 898882** (`tel:+495721898882`)
- E-Mail: **info@esmatex.de**
- Leistungen: Textilveredelung, Textildruck, Stickerei, Werbetechnik, Beschriftungen, Logo-Gestaltung, individuelle Werbemittel

## 6. Phasen-Checkliste

- [x] **Phase 1 — Setup, Konfiguration & CMS-Infrastruktur:** `requirements.md`, Astro SSG, Tailwind, TS strict, `astro.config.mjs` (Supabase-Image-Domains), `vercel.json` (CSP + frame-ancestors), `tailwind.config.mjs` (CSS-Variablen-Mapping)
- [x] **Phase 2 — Design-System, lokale Assets & Content-Architektur:** Fonts lokal (`heading.woff2` = Plus Jakarta Sans 200–800, `body.woff2` = Inter 100–900, via `@fontsource-variable/*` als Update-Quelle), `@font-face` + Preload, 18 SVG-Icons in `src/components/icons/`, `scroll-animate.js` (IntersectionObserver, `prefers-reduced-motion`-sicher), Content Collections mit Zod (`site`/`pages` als diskriminierte Union über `page`, `blog`), `site.json` mit allen Stammdaten (Geo: 52.3298614, 9.192776 via OSM-Geocoding der Bahnhofstr. 65), `pages/*.json` (index/kontakt/impressum/datenschutz), 3 Blog-Fachartikel, `cms.manifest.json` (13 Sektionen, 271 Felder, `features.blog = true`), `Layout.astro` mit CMS-Preview-Bridge. **Hinweis:** Alle Bilder in `public/images/**` sind gestaltete SVG-Platzhalter (Brand-Farbwelt, textfrei) und werden über das CMS durch echte Fotos ersetzt; Öffnungszeiten sind CMS-editierbare Annahmen; Kundenstimmen sind neutrale Platzhalter (vor Launch durch echte Bewertungen ersetzen – UWG).
- [x] **Phase 3 — Sektionsweiser Aufbau:** Startseite (Hero, Stats, Services, Vergleich, Prozess, Showcase, Testimonials, FAQ, CTA mit `data-cms-section` + `data-cms-field`), Header (Sticky-Nav, Telefon-Direktwahl, Angebot-Button, Mobile-Menü) & Footer global im Layout, Blog-Index (3-Spalten-Grid, Tag-Filter clientseitig, Lesezeit) & Blog-Detail (Breadcrumb, TOC aus H2-Heading-IDs, Autor, Tags, B2B-CTA), Kontakt (2-Spalten + ContactForm mit Web3Forms/Honeypot/Inline-Status), Impressum & Datenschutz (Firmendaten dynamisch aus `site.json`). Chrome-Texte (Nav, UI-Labels) in `site.json` → `navigation`/`footer`/`ui`; Ratgeber-Chrome in `pages/blog.json`. Manifest neu generiert: 14 Sektionen, 308 Felder. `astro check`: 0/0/0; `npm run build`: 8 Seiten, Exit 0.
- [x] **Phase 4 — Formulare, Cookie-Banner, A11y & Build:** Web3Forms-Formular (Honeypot `botcheck`, `PUBLIC_WEB3FORMS_KEY` via `.env.example`, barrierefreie Inline-Validierung ohne Reload), DSGVO-Cookie-Banner (100 % Vanilla JS, localStorage `esmatex-consent`, Drittanbieter standardmäßig blockiert, „Nur essenzielle"/„Alle akzeptieren", Texte aus `site.json` → `ui.cookieBanner`), Schema.org JSON-LD: `ProfessionalService` (Inhaberin, Geo, Öffnungszeiten, USt-IdNr. aus `site.json`) im Hauptlayout + `BlogPosting` auf Artikelseiten — im Build verifiziert & parsebar. `npx astro check`: 0 Fehler/0 Warnungen (43 Dateien); `npm run build`: 8 Seiten, Exit 0. Manifest final: 14 Sektionen, 313 Felder.
- [x] **Bugfix — Scroll-Reveal (leere Seite):** `scroll-animate.js` enthielt TS-Generics in `.js`-Datei → Runtime-TypeError, alle `data-animate`-Elemente blieben `opacity: 0`. Fix: reines JS + No-JS-Fallback (Versteck-Regeln nur unter `.js`-Klasse auf `<html>`), zusätzlich CTA-Kontrast `text-ink/70`→`text-ink` (3.97:1 → 6.8:1, WCAG AA) und Testimonial-Sterne aria-korrekt.
- [x] **Update v2 — Onepager + echte Assets:** Reiner Onepager (Blog/Ratgeber & Kontaktseite entfernt; Impressum/Datenschutz bleiben eigene Seiten), Kontakt-Sektion mit Formular (`#kontakt`) und Partner-Sektion **Sport Wilkening** (https://sport-wilkening.de/) in den Onepager integriert. Echtes Logo (`esmatexlogo.png` → `public/images/logo.webp`, abgerundete Ecken als Cyan-Kachel in Header & Footer) und echte Fotos (hero/leistung1–4 → WebP via sharp, 12 MB PNG → 602 KB). Alle internen Links → Anker (`#kontakt` etc.), `vercel.json` Redirects `/kontakt`→`/#kontakt`, `/blog/*`→`/`. Navigation um „Partner" ergänzt, „Ratgeber" entfernt. Showcase behält vorerst SVG-Platzhalter (echte Fotos folgen vom Kunden). Manifest regeneriert: 14 Sektionen, 296 Felder, `features.blog = false`.
