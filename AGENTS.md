# AGENTS.md — esmaTEX Website

> Hinweis für KI-Agenten: Diese Datei beschreibt das Projekt vollständig. Die verbindliche
> Anforderungs- und Architektur-Dokumentation ist `requirements.md` (Deutsch) — sie ist die
> einzige zulässige Faktenquelle für Firmenstammdaten, Design-Tokens und Kontrastregeln.
> Sprache des Projekts (UI-Texte, Kommentare, Doku): **Deutsch**.

## 1. Projektübersicht

Statische Website (SSG) für **esmaTEX** (Textilveredelung, Inhaberin: Ümmü Kaman,
Bahnhofstr. 65, 31655 Stadthagen). Reiner **Onepager** (`/`) mit Anker-Navigation, dazu
die Pflichtseiten `/impressum` und `/datenschutz`. Der Build erzeugt genau **3 HTML-Seiten**.

Kernprinzipien:

- **100 % datenentkoppelt / Zero Hardcoded Content:** Jeder sichtbare Text kommt aus
  JSON-Content-Dateien (`src/content/`), validiert per Zod. Keine Texte direkt in Komponenten.
- **CMS-ready:** Editierbare Elemente tragen `data-cms-field`-Marker (Pfad in der JSON-Datei,
  Punktschreibweise, z. B. `form.serviceOptions.2`), Sektionen `data-cms-section`.
  Eine Live-Preview-Bridge per `postMessage` läuft nur, wenn die Seite im Iframe eingebettet ist.
- **DSGVO-konform:** Fonts 100 % lokal, keine externen Font-/CDN-Calls, Cookie-Banner,
  Formular über Web3Forms statt eigenem Backend.

## 2. Tech-Stack

| Bereich | Technologie |
|---|---|
| Framework | **Astro 5** (`output: 'static'` in `astro.config.mjs`) |
| Styling | **Tailwind CSS 3** via `@astrojs/tailwind`, Design-Tokens als CSS-Variablen |
| Sprache | **TypeScript** strict (`astro/tsconfigs/strict`, `tsconfig.json`) |
| Content | Astro Content Collections (glob-Loader) + Zod-Schemas in `src/content.config.ts` |
| Formulare | **Web3Forms** (Access-Key via `PUBLIC_WEB3FORMS_KEY`, siehe `.env.example`) |
| Bilder | Lokal optimiert (WebP in `public/images/`), Remote-Domain `*.supabase.co` freigegeben |
| Fonts | Lokal: `src/assets/fonts/heading.woff2` (Plus Jakarta Sans variabel), `body.woff2` (Inter variabel) |
| Hosting | **Vercel** (`vercel.json`: Security-Header + Redirects) |

Es gibt **kein** Test-Framework, keinen Linter/Formatter und keine CI-Konfiguration im Repo.

## 3. Build- und Prüf-Befehle

| Befehl | Zweck |
|---|---|
| `npm run dev` (alias `npm start`) | Dev-Server starten |
| `npm run build` | Produktions-Build nach `dist/` (3 Seiten) |
| `npm run preview` | Build lokal ansehen |
| `npm run check` (= `npx astro check`) | **Qualitätsgate: Typ- und Template-Prüfung — muss 0 Fehler / 0 Warnungen liefern** |

Verifizierter Ist-Stand (2026-09-21): `npx astro check` → 0/0/0 (42 Dateien);
`npm run build` → 3 Seiten, Exit 0. **Vor jedem Abschluss beide Befehle ausführen.**

Für das Kontaktformular lokal `.env` aus `.env.example` anlegen
(`PUBLIC_WEB3FORMS_KEY`). `.env` ist gitignoriert.

## 4. Code-Organisation

```
src/
├── content.config.ts        # Zod-Schemas: Collections "site" und "pages" (diskriminierte Union über "page")
├── content/
│   ├── site.json            # Zentrale Firmendaten + Chrome-Texte (navigation/footer/ui.cookieBanner)
│   ├── pages/index.json     # Alle Onepager-Inhalte (hero, stats, services, partner, comparison,
│   │                        #   process, showcase, testimonials, faq, cta, contact, form)
│   ├── pages/impressum.json # Impressum-Texte
│   ├── pages/datenschutz.json
│   └── cms.manifest.json    # CMS-Mapping: 14 Sektionen, 296 Felder, features.blog = false
├── layouts/Layout.astro     # Einziges Layout: Head, Font-Preload, SchemaOrg, CMS-Preview-Bridge,
│                            #   Header/Footer/CookieBanner global, Skip-Link
├── pages/                   # index.astro (Onepager), impressum.astro, datenschutz.astro
├── components/              # Sektions-Komponenten (Hero, Stats, Services, Partner, Comparison,
│   │                        #   Process, Showcase, Testimonials, Faq, Cta, Contact, ContactForm),
│   │                        #   globale Komponenten (Header, Footer, CookieBanner, SchemaOrg,
│   │                        #   SectionHeading)
│   └── icons/               # 18 SVG-Icon-Komponenten (.astro)
├── scripts/scroll-animate.js# Scroll-Reveal via IntersectionObserver (reines JS!)
├── styles/global.css        # Design-Tokens, @font-face, Basis-Layer, FAQ-/Prose-Styles
└── assets/                  # Fonts + Original-Bildquellen (PNG)
public/images/               # Ausgelieferte Bilder (WebP; Showcase-Bilder sind noch SVG-Platzhalter)
```

Seitenaufbau: `src/pages/index.astro` holt per `getEntry('pages', 'index')` den Content und
reicht Sektions-Objekte als Props an die Sektions-Komponenten. `Layout.astro` lädt
`getEntry('site', 'site')` und wirft einen Fehler, wenn `site.json` fehlt.

## 5. Content-Architektur (wichtigster Projekt-Aspekt)

- Schemas in `src/content.config.ts`: Collection `site` (ein Dokument) und `pages`
  (diskriminierte Union über `page`: `index` | `impressum` | `datenschutz`).
  **Jede neue Content-Struktur muss zuerst im Zod-Schema abgebildet werden** — sonst
  schlägt der Build fehl.
- Props-Typen werden aus den Collections abgeleitet, nicht neu definiert, z. B.:
  `type IndexData = Extract<CollectionEntry<'pages'>['data'], { page: 'index' }>;`
- `src/content/cms.manifest.json` bildet jedes editierbare Feld auf
  `id, label, type, file, path, maxLength` ab. **Bei Content-Änderungen muss das Manifest
  mitgepflegt werden** (Ziel: jedes `data-cms-field` im Markup hat einen Manifest-Eintrag).
- Veraltetes entfernen: Blog/Ratgeber und die Kontaktseite existieren nicht mehr
  (Update v2). `vercel.json` leitet `/kontakt` → `/#kontakt` und `/blog/*` → `/` weiter.

## 6. Code-Konventionen

- **Komponenten:** `.astro`, ein `interface Props`, Daten ausschließlich per Props
  (Ausnahme: `Layout.astro`/Seiten laden Collections selbst). Icons als eigene
  Komponenten in `src/components/icons/`.
- **Styling:** Tailwind-Utilities. Farben nur über die Token-Klassen `primary`,
  `primary-dark`, `ink`, `surface`, `muted`, `subtle` (RGB-Triplets aus
  `src/styles/global.css`, gemappt in `tailwind.config.mjs`). Fonts via
  `font-heading` / `font-body`. Keine hex-Farben neu erfinden.
- **CMS-Marker konsequent setzen:** Jeder neue editierbare Text/jedes Bild bekommt
  `data-cms-field="<json-pfad>"`, jede neue Sektion `data-cms-section="<id>"`.
- **Skripte in Komponenten:** `<script>` wird von Astro gebündelt (TS erlaubt);
  `<script is:inline>` nur, wenn unbedingt nötig (Head-Skripte im Layout).
- **`src/scripts/scroll-animate.js` muss reines JavaScript bleiben** — keine
  TS-Syntax/Generics (historischer Bug: Runtime-Fehler → Seite blieb leer, weil
  `[data-animate]`-Elemente `opacity: 0` behielten). Versteck-Regeln greifen nur unter
  der `.js`-Klasse auf `<html>` (No-JS-Fallback); `prefers-reduced-motion` wird respektiert.
- **Animationen:** Sektionen mit `data-animate`, optionales Staggering via
  `data-animate-delay="<ms>"`.
- **Accessibility (WCAG 2.2 AA, verbindlich):**
  - Auf Brand-Flächen `#41A9E6` (`bg-primary`) nur dunkler Text `text-ink` — kein weißer Kleintext.
  - Farbige Text-Links auf Weiß: `text-primary-dark` (`#1F72A6`), nie `#41A9E6`.
  - Fokus-Ringe sichtbar (`focus-visible` ist global in `global.css` definiert).
  - FAQ-Akkordeon: natives `<details>/<summary>`. Dekorative Elemente `aria-hidden`.

## 7. Testing-Strategie

Es gibt keine Unit-/E2E-Tests. Qualitätssicherung besteht aus:

1. `npx astro check` — 0 Fehler, 0 Warnungen (Zod-Schemas prüfen Content zur Build-Zeit).
2. `npm run build` — muss mit Exit 0 durchlaufen und 3 Seiten erzeugen.
3. Stichprobe im Build-Output: JSON-LD (`SchemaOrg.astro`, `ProfessionalService`) muss im
   HTML parsebar sein; CSP-Header stehen in `vercel.json` (greifen erst auf Vercel).

## 8. Deployment & Sicherheit

- **Deployment:** Vercel, statisches Output aus `dist/`. `vercel.json` setzt
  Security-Header und permanente Redirects (`/kontakt` → `/#kontakt`, `/blog/*` → `/`).
- **CSP (in `vercel.json`, nicht ändern ohne Grund):** `default-src 'self'`,
  `img-src ... https://*.supabase.co`, `connect-src ... https://api.web3forms.com`,
  `frame-ancestors 'self' http://localhost:* https://*.vercel.app`. **Kein**
  `X-Frame-Options: DENY` — die CMS-Preview bettet die Seite per Iframe ein.
- **CMS-Preview-Bridge (`src/layouts/Layout.astro`):** `postMessage`-Listener nur aktiv bei
  `window.self !== window.top`; bei `CMS_FIELD_UPDATE` wird das Ziel per `data-cms-field`
  gesucht und `innerText` (bei `<img>`: `src`) aktualisiert. Keine Origin-Prüfung —
  bewusst einfach gehalten, da nur Text/Bild-URLs ins eigene DOM geschrieben werden.
- **Formular (`src/components/ContactForm.astro`):** Web3Forms-Endpoint, Honeypot-Feld
  `botcheck`, clientseitige Validierung ohne Reload. Der `PUBLIC_WEB3FORMS_KEY` ist
  absichtlich öffentlich (Web3Forms-Modell); echte Secrets gehören nicht ins Repo.
- **DSGVO:** Cookie-Banner (`CookieBanner.astro`) mit localStorage-Key `esmatex-consent`,
  Drittanbieter standardmäßig blockiert, Custom Event `esma:consent`. Fonts lokal,
  keine Google-Fonts/CDNs. Bilder ggf. künftig von Supabase (`img-src` ist vorbereitet).

## 9. Verifizierte Stammdaten (nicht raten, nicht ändern)

esmaTEX · Inhaberin: Ümmü Kaman · Einzelunternehmen · USt-IdNr. DE353978752 ·
Bahnhofstr. 65, 31655 Stadthagen · Tel. 05721 898882 (`tel:+495721898882`) ·
info@esmatex.de · Partner-Sektion: Sport Wilkening (https://sport-wilkening.de/).
Öffnungszeiten und Kundenstimmen sind CMS-editierbare Platzhalter (vor Launch durch echte
Bewertungen ersetzen — UWG); Showcase-Bilder sind noch SVG-Platzhalter.
