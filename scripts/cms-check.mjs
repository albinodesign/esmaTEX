#!/usr/bin/env node
/**
 * scripts/cms-check.mjs — Maschinenprüfung der CMS-Integration.
 *
 * Contract: CMS-REFERENCE.md (im Repo-Root), Version 1.5.
 * Geprüfte Abschnitte: 2 (Registry), 3 (Manifest), 3.2 (Blockierer),
 * 4 (Feldtypen), 5 (Grenzen L1–L8), 6 (Content-Dateien), 7 (Brücke),
 * 9 (Hosting/Sicherheit), 11 (Selbst-Check).
 *
 * Aufruf:  node scripts/cms-check.mjs
 * Exitcode 0 = keine Fehler, 1 = mindestens ein Fehler.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const HTML_DIR = path.resolve(ROOT, process.env.CMS_CHECK_HTML ?? 'dist');

/* ---------------------------------------------------------------- *
 * Registry (Abschnitt 2) — feste, nicht verhandelbare Werte
 * ---------------------------------------------------------------- */
const CMS_ORIGIN = 'https://agency-cms-teal.vercel.app';
const CMS_ORIGIN_LOCAL = 'http://localhost:3000';
const BUCKET = 'cms-media';
const LIVE_HOST = 'www.esmatex.de';
const PREVIEW_HOST = 'vercel.app';

const ALLOWED_TYPES = new Set([
  'text', 'textarea', 'image', 'number', 'email', 'phone', 'url', 'date', 'boolean'
]);
const ALLOWED_ASPECT = new Set(['16:9', '1:1', '4:3']);
const BANNER_VARIANTS = new Set(['vacation', 'emergency', 'info']);
const FORBIDDEN_SEGMENTS = new Set(['__proto__', 'constructor', 'prototype']);
const PLACEHOLDER = /cms\.deine-agentur\.de|cms\.example\.com|cms\.invalid|example\.com|<projekt>|\.\.\./i;

const errors = [];
const warnings = [];
const infos = [];

/** Marker auf einem Element, in dessen Kindbereich ein weiterer Marker liegt (7.1). */
const VOID = new Set(['area','base','br','col','embed','hr','img','input','link','meta','param','source','track','wbr']);
function findNestedMarkers(html) {
  const tagRe = /<(\/?)([a-zA-Z][a-zA-Z0-9-]*)([^>]*?)(\/?)>/g;
  const stack = [];
  const found = new Set();
  let m;
  while ((m = tagRe.exec(html))) {
    const [, slash, name, attrs, selfClose] = m;
    const tag = name.toLowerCase();
    if (VOID.has(tag) || selfClose === '/') continue;
    const marker = /data-cms-field="([^"]*)"/.exec(attrs)?.[1];
    if (slash) {
      for (let i = stack.length - 1; i >= 0; i--) {
        if (stack[i].tag === tag) {
          for (const inner of stack.slice(i + 1)) {
            if (inner.marker && inner.marker !== marker) found.add(`${marker} > ${inner.marker}`);
          }
          stack.length = i;
          break;
        }
      }
    } else stack.push({ tag, marker });
  }
  return [...found];
}

const err = (code, msg) => errors.push({ code, msg });
const warn = (code, msg) => warnings.push({ code, msg });
const info = (code, msg) => infos.push({ code, msg });

const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const exists = (rel) => fs.existsSync(path.join(ROOT, rel));
const readJson = (rel) => JSON.parse(read(rel));

/* ---------------------------------------------------------------- *
 * 0. Contract-Datei selbst
 * ---------------------------------------------------------------- */
let refVersion = null;
if (!exists('CMS-REFERENCE.md')) {
  err('REF-001', 'CMS-REFERENCE.md fehlt im Repo-Root (Abschnitt 11/13: gehört ins Website-Repo).');
} else {
  const ref = read('CMS-REFERENCE.md');
  const vm = /\*\*Version:\*\*\s*([\d.]+)/.exec(ref);
  refVersion = vm ? vm[1] : null;
  if (!refVersion) warn('REF-002', 'CMS-REFERENCE.md: Versionszeile nicht lesbar.');
  for (const p of ['cms.deine-agentur.de', 'cms.example.com', 'cms.invalid']) {
    // Abschnitt 2 nennt diese Werte selbst als Beispiele — nur im Fließtext ok.
    const inCode = ref.includes('`' + p + '`') || ref.includes('"' + p + '"');
    if (!inCode) warn('REF-003', `CMS-REFERENCE.md: Platzhalter "${p}" ohne Code-Markierung — bitte prüfen.`);
  }
}

/* ---------------------------------------------------------------- *
 * 1. Manifest (Abschnitt 3)
 * ---------------------------------------------------------------- */
const MANIFEST = 'src/content/cms.manifest.json';
if (!exists(MANIFEST)) {
  err('MAN-001', `${MANIFEST} fehlt — ohne Manifest erscheinen keine Felder im Editor.`);
  report();
}
const manifest = readJson(MANIFEST);

// version: Konvention, kein Fehler
if (manifest.version !== 2) info('MAN-002', `manifest.version ist ${JSON.stringify(manifest.version)} — Konvention ist 2.`);

const rawSections = Array.isArray(manifest.sections)
  ? manifest.sections
  : Array.isArray(manifest)
    ? manifest
    : null;
if (!Array.isArray(rawSections)) {
  err('MAN-003', 'Manifest hat kein auswertbares "sections"-Array.');
  report();
}
const sections = rawSections.map((raw, index) => ({ raw, fields: raw.fields ?? [], index }));

// features.blog
const blogFeature = manifest.features?.blog;
const blogEnabled = blogFeature === true || (!!blogFeature && blogFeature.enabled === true);
if (blogFeature !== undefined && typeof blogFeature !== 'boolean' && !blogEnabled)
  err('MAN-004', 'features.blog muss true oder { "enabled": true } sein.');

if (!sections.some((s) => s.fields.length > 0)) {
  err('MAN-005', 'Manifest enthält keine Sektion mit Feldern → ungültig.');
}

// blog nur, wenn die Website einen hat (Abschnitt 8)
const hasBlogRoutes = fs.existsSync(path.join(ROOT, 'src/pages/blog'));
if (blogEnabled && !hasBlogRoutes)
  err('BLG-001', 'features.blog ist aktiv, aber es gibt keine Blog-Routen (Abschnitt 8).');
if (!blogEnabled && hasBlogRoutes)
  err('BLG-002', 'Blog-Routen vorhanden, aber features.blog ist nicht aktiv.');

/* ---------------------------------------------------------------- *
 * 2. Sektionen (Abschnitt 3.1) + Tabs (Abschnitt 7.5)
 * ---------------------------------------------------------------- */
const sectionIds = new Set();
const pageFilesByTab = new Map();

for (const s of sections) {
  const where = `Sektion #${s.index}${s.raw.id ? ` "${s.raw.id}"` : ''}`;

  if (typeof s.raw.id !== 'string' || !s.raw.id.trim()) {
    err('SEC-001', `${where}: "id" fehlt → CMS vergibt "section-${s.index}" und zeigt eine Warnung.`);
  } else if (sectionIds.has(s.raw.id)) {
    err('SEC-002', `${where}: "id" doppelt.`);
  } else {
    sectionIds.add(s.raw.id);
  }

  if (typeof s.raw.title !== 'string' || !s.raw.title.trim()) {
    const hasLabel = typeof s.raw.label === 'string' && s.raw.label.trim();
    err(
      'SEC-003',
      `${where}: "title" fehlt${hasLabel ? ' (nur "label" — laut 3.1 ist "label" Teil der Fallback-Kette, "title" der Soll-Wert)' : ''} → Editor zeigt Fallback + Warnung.`
    );
  }

  if (typeof s.raw.page !== 'string' || !s.raw.page.trim()) {
    err('SEC-004', `${where}: "page" fehlt → Editor rät per Heuristik, Vorschau-URL ist unzuverlässig (Abschnitt 3.1/7.5).`);
  } else {
    // 7.5: je Tab genau eine Seiten-Datei, sonst verschwindet eine in der Vorschau
    const pageFiles = [
      ...new Set(s.fields.map((f) => f.file).filter((f) => f.startsWith('src/content/pages/')))
    ];
    const tab = pageFilesByTab.get(s.raw.page) ?? new Set();
    pageFiles.forEach((f) => tab.add(f));
    pageFilesByTab.set(s.raw.page, tab);
    // site.json zählt nicht: es wird auf allen Seiten gerendert
    if (pageFiles.length > 1) {
      err(
        'SEC-005',
        `${where}: Tab "${s.raw.page}" führt Felder aus mehreren Seiten-Dateien (${pageFiles.join(', ')}) → die Vorschau zeigt nur eine davon (Abschnitt 7.5).`
      );
    }
  }

  if (s.fields.length === 0) warn('SEC-006', `${where}: keine Felder → Sektion wird ausgeblendet und gemeldet.`);
}

for (const [tab, files] of pageFilesByTab) {
  if (files.size > 1)
    err('SEC-007', `Tab "${tab}" bündelt mehrere Seiten-Dateien: ${[...files].join(', ')} (Abschnitt 7.5: je Tab eine Seite).`);
}

/* ---------------------------------------------------------------- *
 * 3. Felder (Abschnitt 3, 3.2, 3.3, 4, 5)
 * ---------------------------------------------------------------- */
const fieldIds = new Map();
const targets = new Map();
const allFields = [];

for (const s of sections) for (const f of s.fields) allFields.push({ f, section: s });

for (const { f, section } of allFields) {
  const where = `Feld "${f?.id ?? '(ohne id)'}" (${section.raw.id ?? section.index})`;

  // 3.3 — ID-Charset. camelCase ist laut 3.3 erlaubt; Zeichen < > " ' ` und
  // Leerzeichen werden vom Manifest zwar geladen, vom Klick-Pfad aber verworfen.
  if (typeof f.id !== 'string' || !f.id) {
    err('FLD-001', `${where}: "id" fehlt.`);
  } else if (PLACEHOLDER.test(f.id)) {
    err('FLD-002', `${where}: "id" enthält einen Platzhalter.`);
  } else if (/[<>"'`]/.test(f.id) || /\s/.test(f.id)) {
    err(
      'FLD-003',
      `${where}: "id" enthält <>"'\` oder Leerzeichen — im Manifest sichtbar, aber der Klick-Pfad verwirft sie still (isSafeFieldId, Abschnitt 3.3).`
    );
  } else if (!/^[A-Za-z0-9._-]+$/.test(f.id)) {
    err('FLD-004', `${where}: "id" enthält unzulässige Zeichen (erlaubt: [a-zA-Z0-9._-]).`);
  }

  // 3.2 Regel 1 — IDs global eindeutig
  if (typeof f.id === 'string' && f.id) {
    if (fieldIds.has(f.id)) {
      const prev = fieldIds.get(f.id);
      err(
        'FLD-005',
        `${where}: "id" doppelt vergeben (bereich "${prev.section}" → ${prev.file}#${prev.path}) → JEDE Veröffentlichung wird mit 400 abgelehnt (Abschnitt 3.2, Regel 1).`
      );
    } else {
      fieldIds.set(f.id, { section: section.raw.id, file: f.file, path: f.path, type: f.type });
    }
  }

  if (typeof f.label !== 'string' || !f.label.trim())
    warn('FLD-006', `${where}: "label" fehlt → Editor nutzt "title"/"id".`);

  if (!ALLOWED_TYPES.has(f.type)) {
    err(
      'FLD-007',
      `${where}: "type" "${f.type}" ist unbekannt (Abschnitt 4) → im Editor still "text", im Publish hart abgelehnt.`
    );
  }

  // 3.1 — file
  const file = f.file ?? '';
  const fileOk =
    file === 'src/content/site.json' ||
    (/^src\/content\/pages\/[A-Za-z0-9][A-Za-z0-9._-]*\.json$/.test(file) &&
      !file.includes('..') &&
      file.length <= 200);
  if (!fileOk)
    err('FLD-008', `${where}: "file" "${file}" ist nicht erlaubt (nur src/content/site.json oder src/content/pages/*.json, Abschnitt 3.1/6.2).`);

  // 3.2 Regel 2 — ein Schreibziel, ein Feld
  if (file && f.path) {
    const norm = String(f.path).replace(/\[(\d+)\]/g, '.$1');
    const key = `${file}#${norm}`;
    if (targets.has(key)) {
      const prev = targets.get(key);
      err(
        'FLD-009',
        `${where}: gleiches Schreibziel wie "${prev}" (${key}) → Publish-Abweisung (Abschnitt 3.2, Regel 2). Für mehrfach dargestellte Werte EIN Feld anlegen und alle Vorkommen markieren.`
      );
    } else {
      targets.set(key, f.id);
    }
  }

  // 3.3 — Pfad
  const p = f.path ?? '';
  const segs = String(p).split('.');
  if (!p) err('FLD-010', `${where}: "path" fehlt.`);
  else {
    if (segs.length > 20) err('FLD-011', `${where}: "path" hat mehr als 20 Ebenen.`);
    if (p.length > 500) err('FLD-012', `${where}: "path" ist länger als 500 Zeichen.`);
    if (segs.some((s) => s === '')) err('FLD-013', `${where}: "path" enthält einen leeren Abschnitt (a..b).`);
    if (segs.some((s) => FORBIDDEN_SEGMENTS.has(s))) err('FLD-014', `${where}: "path" enthält ein verbotenes Segment.`);
    if (/\[[^\]]*[^\d\]][^\]]*\]/.test(p)) err('FLD-015', `${where}: "path" enthält nicht-numerische Klammern.`);
    const idx = segs.find((s) => /^\d+$/.test(s));
    if (idx !== undefined && Number(idx) > 9999) err('FLD-016', `${where}: Listen-Index ${idx} > 9999.`);
  }

  // 3.1 — maxLength
  if (f.maxLength !== undefined && (!Number.isInteger(f.maxLength) || f.maxLength < 1 || f.maxLength > 10000))
    err('FLD-017', `${where}: "maxLength" muss ganze Zahl 1–10000 sein (ist ${JSON.stringify(f.maxLength)}).`);

  // 3.1 — aspectRatio nur bei image, exakt 16:9 / 1:1 / 4:3
  if (f.aspectRatio !== undefined) {
    if (f.type !== 'image')
      warn('FLD-018', `${where}: "aspectRatio" ist nur bei type "image" erlaubt.`);
    else if (!ALLOWED_ASPECT.has(f.aspectRatio))
      warn('FLD-019', `${where}: "aspectRatio" "${f.aspectRatio}" wird ignoriert (erlaubt: 16:9, 1:1, 4:3).`);
  }

  // Abschnitt 5 — Konzepte, die das CMS nicht hat
  if (/(^|\.)alt$/i.test(String(p)) || /(^|\.)alt$/i.test(String(f.id)))
    err('FLD-020', `${where}: Alt-Text-Feld — das CMS hat dafür kein Feld (L1). "alt" gehört fest ins Template, editierbar ist nur das Bild.`);
  if (/(^|\.)(href|linkhref|link|target|tel|mailto)$/i.test(segs.at(-1) ?? ''))
    err('FLD-021', `${where}: Feld für ein Linkziel — laut L8 werden tel:/mailto:/Button-URLs abgeleitet und sind nicht frei editierbar.`);
}

/* ---------------------------------------------------------------- *
 * 4. Content-Dateien (Abschnitt 4, 6, 10)
 * ---------------------------------------------------------------- */
const cache = new Map();
const load = (rel) => {
  if (!cache.has(rel)) cache.set(rel, exists(rel) ? readJson(rel) : null);
  return cache.get(rel);
};
const getByPath = (obj, dotPath) => {
  let cur = obj;
  for (const seg of String(dotPath).replace(/\[(\d+)\]/g, '.$1').split('.')) {
    if (cur === null || typeof cur !== 'object' || !(seg in cur)) return { found: false };
    cur = cur[seg];
  }
  return { found: true, value: cur };
};

for (const [id, meta] of fieldIds) {
  const { file, path: dotPath, type } = meta;
  if (!file || !dotPath) continue;
  const data = load(file);
  if (data === null) {
    err('DAT-001', `Feld "${id}": Zieldatei ${file} existiert nicht.`);
    continue;
  }
  const { found, value } = getByPath(data, dotPath);
  if (!found) {
    err('DAT-002', `Feld "${id}": Pfad "${dotPath}" existiert in ${file} nicht → Publish schlägt fehl.`);
    continue;
  }
  // 4 — JSON-Treue
  if (type === 'number' && typeof value !== 'number')
    err('DAT-003', `Feld "${id}": type "number", Wert ist ${JSON.stringify(value)} — Publish blockiert die Datei (echte JSON-Zahl nötig).`);
  if (type === 'boolean' && typeof value !== 'boolean')
    err('DAT-004', `Feld "${id}": type "boolean", Wert ist ${JSON.stringify(value)} — Publish blockiert die Datei.`);
  if (['text', 'textarea', 'email', 'phone', 'url', 'date', 'image'].includes(type) && typeof value !== 'string')
    err('DAT-005', `Feld "${id}": type "${type}", Wert ist ${JSON.stringify(value)} (muss String sein).`);
  if (value === null) err('DAT-006', `Feld "${id}": Wert ist null — der Endstand darf in deklarierten Feldern nie null sein (Abschnitt 4).`);
  if (type === 'email' && typeof value === 'string' && value !== '' && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value))
    err('DAT-007', `Feld "${id}": type "email", aber "${value}" ist keine gültige Adresse.`);
  if (type === 'phone' && typeof value === 'string' && value !== '' && !/^[+\d]/.test(value))
    warn('DAT-008', `Feld "${id}": type "phone", "${value}" beginnt nicht mit "+" oder Ziffer.`);
  if (type === 'date' && typeof value === 'string' && value !== '' && (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(value))))
    err('DAT-009', `Feld "${id}": type "date", "${value}" ist kein gültiges JJJJ-MM-TT.`);
  if (type === 'image' && typeof value === 'string' && value) {
    if (/^javascript:|^data:/i.test(value) || value.includes('..') || /[\s"'`]/.test(value))
      err('DAT-010', `Feld "${id}": unzulässiger Bildwert "${value}" (Abschnitt 4).`);
  }
  const field = allFields.find((x) => x.f.id === id)?.f;
  if (field?.maxLength !== undefined) {
    const len = typeof value === 'string' ? value.length : JSON.stringify(value ?? '').length;
    if (len > field.maxLength)
      err('DAT-011', `Feld "${id}": ${len} Zeichen > maxLength ${field.maxLength} → Publish blockiert die Datei.`);
  }
}

// 6.1 — banner exakt { enabled, variant, text }
const site = load('src/content/site.json');
if (site) {
  const banner = site.banner;
  if (banner === undefined) {
    err('BNR-001', 'site.json: "banner" fehlt. Standard laut Abschnitt 6.1: { "enabled": false, "variant": "info", "text": "" }.');
  } else {
    for (const k of Object.keys(banner))
      if (!['enabled', 'variant', 'text'].includes(k))
        err('BNR-002', `site.json: banner enthält unbekannten Schlüssel "${k}" → wird abgelehnt (Abschnitt 6.1).`);
    if (typeof banner.enabled !== 'boolean') err('BNR-003', 'site.json: banner.enabled muss echter Boolean sein.');
    if (!BANNER_VARIANTS.has(banner.variant))
      err('BNR-004', `site.json: banner.variant "${banner.variant}" → Publish blockiert site.json (nur vacation/emergency/info).`);
    if (typeof banner.text !== 'string') err('BNR-005', 'site.json: banner.text muss String sein.');
    else if (banner.text.length > 160) err('BNR-006', 'site.json: banner.text ist länger als 160 Zeichen.');
    if (banner.enabled === true && !banner.text) warn('BNR-007', 'site.json: banner.enabled=true, aber text ist leer.');
  }
} else {
  err('DAT-012', 'src/content/site.json fehlt oder ist kein gültiges JSON.');
}

// 6.3 — JSON-Format: 2 Leerzeichen (CMS schreibt JSON.stringify(data, null, 2))
for (const rel of ['src/content/site.json', 'src/content/cms.manifest.json', ...(exists('src/content/pages') ? fs.readdirSync(path.join(ROOT, 'src/content/pages')).filter((f) => f.endsWith('.json')).map((f) => `src/content/pages/${f}`) : [])]) {
  const raw = read(rel);
  if (raw.includes('\r')) warn('DAT-013', `${rel}: CRLF-Zeilenenden — Diff-Rauschen (Abschnitt 6.3).`);
  if (raw.includes('\t')) warn('DAT-014', `${rel}: Tab-Einrückung — das CMS schreibt mit 2 Leerzeichen (Abschnitt 6.3).`);
  if (PLACEHOLDER.test(raw) && !rel.endsWith('cms.manifest.json'))
    warn('DAT-015', `${rel}: enthält einen Platzhalter — bitte prüfen.`);
}

/* ---------------------------------------------------------------- *
 * 5. Brücke (Abschnitt 7.2)
 * ---------------------------------------------------------------- */
let bridge = null;
let bridgeFile = null;
if (exists('src/layouts')) {
  for (const f of fs.readdirSync(path.join(ROOT, 'src/layouts'))) {
    if (!f.endsWith('.astro')) continue;
    const src = read(`src/layouts/${f}`);
    if (src.includes('CMS_FIELD_UPDATE') || src.includes('postMessage')) {
      bridge = src;
      bridgeFile = f;
      break;
    }
  }
}
if (!bridge) {
  err('BRG-001', 'Keine Vorschau-Brücke im Root-Layout gefunden (Abschnitt 7.2).');
} else {
  const body = bridge.slice(bridge.indexOf('<script is:inline>'));
  if (!/window\.self !== window\.top/.test(body))
    err('BRG-002', `${bridgeFile}: Brücke ist nicht auf den Iframe-Betrieb begrenzt.`);

  if (/postMessage\(([\s\S]{0,600}?)["']\*["']/.test(body))
    err('BRG-003', `${bridgeFile}: postMessage(…, "*") — Antworten gehen immer an den verifizierten Origin (Abschnitt 7.2, Regel 1).`);

  if (!/CMS_ORIGINS/.test(body)) {
    err('BRG-004', `${bridgeFile}: keine CMS_ORIGINS — ohne Origin-Prüfung ist die Vorschau manipulierbar.`);
  } else {
    // Nur die tatsächliche Array-Zuweisung lesen, nicht den Rest der Datei.
    const decl = /CMS_ORIGINS\s*=\s*\[([\s\S]*?)\]/.exec(body);
    const origins = decl ? [...decl[1].matchAll(/["'`](https?:\/\/[^"'`]+)["'`]/g)].map((m) => m[1]) : [];
    if (!origins.includes(CMS_ORIGIN))
      err('BRG-005', `${bridgeFile}: CMS_ORIGINS enthält "${CMS_ORIGIN}" NICHT (gefunden: ${origins.join(', ') || 'nichts'}).`);
    if (origins.some((o) => /deine-agentur|example|invalid|placeholder/i.test(o)))
      err('BRG-006', `${bridgeFile}: CMS_ORIGINS enthält einen Platzhalter (Abschnitt 2).`);
    // Wildcard-Ersatz = echter Platzhalter wie "https://*.vercel.app" oder ein
    // leerer Wert. Eine konkrete Subdomain (agency-cms-teal.vercel.app) endet
    // zwar ebenfalls auf .vercel.app, ist aber der korrekte Registry-Wert.
    if (origins.some((o) => /\*/.test(o)))
      err('BRG-007', `${bridgeFile}: CMS-Origin enthält ein Wildcard ("*") — das nimmt den Produktionsschutz.`);
    if (origins.some((o) => /127\.0\.0\.1/.test(o)))
      warn('BRG-008', `${bridgeFile}: 127.0.0.1 in CMS_ORIGINS — funktioniert nur, wenn das CMS exakt darüber läuft.`);
    if (!origins.includes(CMS_ORIGIN_LOCAL))
      warn('BRG-009', `${bridgeFile}: CMS_ORIGINS enthält "${CMS_ORIGIN_LOCAL}" nicht (lokale CMS-Entwicklung, Abschnitt 2).`);
  }

  if (!/event\.origin/.test(body)) err('BRG-010', `${bridgeFile}: event.origin wird nicht geprüft (Regel 2).`);
  if (!/event\.source\s*!==\s*window\.parent/.test(body)) err('BRG-011', `${bridgeFile}: event.source wird nicht gegen window.parent geprüft (Regel 2).`);
  if (/innerText/.test(body)) err('BRG-012', `${bridgeFile}: innerText — zerstört Icons und verschachteltes Markup (Regel 3).`);
  if (!/textContent/.test(body)) err('BRG-013', `${bridgeFile}: textContent fehlt (Regel 3).`);
  if (!/CSS\.escape/.test(body)) err('BRG-014', `${bridgeFile}: CSS.escape fehlt — Selektor-Injection (Abschnitt 12).`);
  if (!/CMS_FIELD_SELECT/.test(body)) err('BRG-015', `${bridgeFile}: CMS_FIELD_SELECT fehlt — Klicks im Editor landen im Leeren (7.3).`);
  if (!/CMS_SELECT_MODE/.test(body)) err('BRG-016', `${bridgeFile}: CMS_SELECT_MODE fehlt (7.3).`);
  if (!/CMS_BRIDGE_READY/.test(body)) err('BRG-017', `${bridgeFile}: CMS_BRIDGE_READY fehlt — Brücke ohne READY verliert Klicks nach In-Preview-Navigation (7.4, Punkt 3).`);
  if (!/removeAttribute\(["']srcset["']\)/.test(body)) err('BRG-018', `${bridgeFile}: srcset wird bei IMG nicht entfernt (7.2).`);
  if (!/typeof event\.data\.field\s*!==\s*["']string["']/.test(body)) err('BRG-019', `${bridgeFile}: Typprüfung für field/value fehlt (7.2, Punkt 3).`);
  if (!/\[<>"'`]/.test(body)) err('BRG-020', `${bridgeFile}: Injection-Prüfung der Feld-ID fehlt (7.2, Punkt 4).`);

  // Regel 4: kein window.location.origin in CMS_ORIGINS
  if (/CMS_ORIGINS[\s\S]{0,300}location\.origin/.test(body))
    err('BRG-021', `${bridgeFile}: window.location.origin in CMS_ORIGINS — die eigene Website ist keine CMS-Origin (Regel 4).`);

  // verbatim-Abgleich gegen die Referenz
  if (refVersion) {
    const refSrc = read('CMS-REFERENCE.md');
    const block = /```html\n(<script is:inline>[\s\S]*?<\/script>)\n```/.exec(refSrc);
    // Das Brücken-Script gezielt suchen: im Layout stehen mehrere Inline-Scripts.
    const mine = (bridge.match(/<script is:inline>\s*\n\s*if \(window\.self[\s\S]*?<\/script>/) ?? [])[0];
    if (block && mine) {
      // Nur der Code-Teil zählt: Kommentare, Einrückung und Anführungszeichen
      // werden normalisiert, sonst meldet der Check eigenen Stil statt Inhalt.
      const strip = (s) =>
        s
          .replace(/<script is:inline>|<\/script>/g, '')
          .split('\n')
          .map((l) => l.replace(/\/\/.*$/, '').replace(/^\s+/, '').replace(/\s+/g, ' ').trim())
          .filter(Boolean)
          .join('\n');
      if (strip(block[1]) !== strip(mine))
        err('BRG-022', `${bridgeFile}: Code weicht vom Verbatim-Block in Abschnitt 7.2 ab.`);
      else info('BRG-023', `${bridgeFile}: Brücke ist zeichengleich mit Abschnitt 7.2.`);
    }
  }
}

/* ---------------------------------------------------------------- *
 * 6. Hosting & Sicherheit (Abschnitt 9)
 * ---------------------------------------------------------------- */
if (!exists('vercel.json')) {
  err('DEP-001', 'vercel.json fehlt.');
} else {
  let vj;
  try {
    vj = readJson('vercel.json');
  } catch (e) {
    err('DEP-002', `vercel.json ist kein gültiges JSON (${e.message}).`);
  }
  if (vj) {
    const blocks = vj.headers ?? [];
    const allHeaders = blocks.flatMap((b) => b.headers ?? []);

    // 9.3 — _headers
    if (exists('public/_headers')) {
      warn('DEP-003', 'public/_headers existiert — dort darf KEIN X-Frame-Options stehen (Abschnitt 9.3).');
      if (/x-frame-options/i.test(read('public/_headers')))
        err('DEP-004', 'public/_headers enthält X-Frame-Options — blockiert das CMS-Iframe (Abschnitt 9.3).');
    }

    // 7.4 Punkt 4 / 12 — X-Frame-Options
    if (allHeaders.some((h) => h.key.toLowerCase() === 'x-frame-options'))
      err('DEP-005', 'X-Frame-Options gesetzt — blockiert das CMS-Iframe unabhängig von CSP (Abschnitt 7.4/12).');

    // 9.2 — zwei Blöcke, beide mit has-Guard
    const cspBlocks = blocks.filter((b) =>
      (b.headers ?? []).some((h) => h.key.toLowerCase() === 'content-security-policy')
    );
    if (cspBlocks.length === 0) {
      err('DEP-006', 'kein Content-Security-Policy-Header.');
    } else {
      for (const [i, b] of cspBlocks.entries()) {
        if (!b.has || !Array.isArray(b.has) || b.has.length === 0)
          err(
            'DEP-007',
            `CSP-Block #${i + 1} (source "${b.source}") hat keinen "has"-Guard → er greift auch auf der Live-Domain (Abschnitt 9.2).`
          );
      }
      // Live-Domain: frame-ancestors 'self' ohne CMS-Origin
      const live = cspBlocks.filter((b) =>
        (b.has ?? []).some((h) => h.type === 'host' && h.value === LIVE_HOST)
      );
      if (live.length === 0) {
        warn('DEP-008', `Kein CSP-Block mit has-Guard für die Live-Domain "${LIVE_HOST}" (Abschnitt 9.2).`);
      } else {
        for (const b of live) {
          const csp = b.headers.find((h) => h.key.toLowerCase() === 'content-security-policy').value;
          const fa = /frame-ancestors([^;]*)/.exec(csp)?.[1] ?? '';
          if (fa.includes(CMS_ORIGIN))
            warn('DEP-009', 'Live-Domain erlaubt die CMS-Origin in frame-ancestors — nur der Preview-Block sollte das (Abschnitt 9.2).');
          if (/https?:\/\/\*|\*\.vercel\.app/.test(fa))
            err('DEP-010', 'Live-Domain hat ein Wildcard in frame-ancestors — jeder Vercel-Host darf die Produktion einbetten (Abschnitt 9.2).');
        }
      }
      // Preview-Host: CMS-Origin explizit
      const preview = cspBlocks.filter((b) =>
        (b.has ?? []).some((h) => h.type === 'host' && h.value === PREVIEW_HOST)
      );
      if (preview.length === 0) {
        err('DEP-011', `Kein CSP-Block mit has-Guard für den Preview-Host "${PREVIEW_HOST}" — die Vorschau bleibt leer (Abschnitt 9.2).`);
      } else {
        for (const b of preview) {
          const csp = b.headers.find((h) => h.key.toLowerCase() === 'content-security-policy').value;
          const fa = /frame-ancestors([^;]*)/.exec(csp)?.[1] ?? '';
          if (!fa.includes(CMS_ORIGIN))
            err('DEP-012', `Preview-Block: frame-ancestors nennt die CMS-Origin "${CMS_ORIGIN}" nicht → Vorschau bleibt leer.`);
        }
      }
      // img-src für CMS-Bilder
      for (const b of cspBlocks) {
        const csp = b.headers.find((h) => h.key.toLowerCase() === 'content-security-policy').value;
        const img = /img-src([^;]*)/.exec(csp)?.[1] ?? '';
        if (!/supabase\.co/.test(img))
          err('DEP-013', `CSP img-src ohne supabase.co — CMS-Bilder (Bucket ${BUCKET}) werden blockiert.`);
      }
    }

    for (const [key, label] of [
      ['x-content-type-options', 'X-Content-Type-Options'],
      ['referrer-policy', 'Referrer-Policy'],
      ['permissions-policy', 'Permissions-Policy'],
      ['strict-transport-security', 'Strict-Transport-Security']
    ]) {
      if (!allHeaders.some((h) => h.key.toLowerCase() === key)) warn('DEP-014', `Header "${label}" fehlt.`);
    }

    if (!/astro build/.test(read('package.json')))
      err('DEP-015', 'package.json hat kein Build-Skript mit "astro build" (Abschnitt 11).');
  }
}

// 9.4 — astro.config.mjs: image.remotePatterns, kein Wildcard unter image.domains
if (!exists('astro.config.mjs')) {
  warn('DEP-016', 'astro.config.mjs fehlt.');
} else {
  const ac = read('astro.config.mjs');
  const hasRemote = /remotePatterns\s*:\s*\[/.test(ac);
  const hasDomains = /domains\s*:\s*\[/.test(ac);
  if (!hasRemote) {
    err(
      'IMG-001',
      'astro.config.mjs: image.remotePatterns fehlt — der Build schlägt fehl, sobald das erste CMS-Bild verwendet wird (Abschnitt 9.4).'
    );
  }
  if (hasDomains)
    err('IMG-002', 'astro.config.mjs: image.domains ist veraltet — der konkrete Supabase-Host gehört in remotePatterns (Abschnitt 9.4).');
  if (/limitInputPixels\s*:\s*false/.test(ac))
    err('IMG-003', 'astro.config.mjs: limitInputPixels: false deaktiviert Astros Schutz gegen über große Bilder (Abschnitt 9.4).');
  if (hasRemote && !/supabase\.co/.test(ac))
    warn('IMG-004', 'astro.config.mjs: remotePatterns ohne supabase.co-Host.');
  // CMS-Bilder laufen über plain <img>; der Build bricht dann nicht — Hinweis.
  if (hasRemote && !/<Image[\s>]/.test(read('src/layouts/Layout.astro') || '')) {
    const usesImage = fs
      .readdirSync(path.join(ROOT, 'src/components'))
      .filter((f) => f.endsWith('.astro'))
      .some((f) => /<Image[\s>]/.test(read(`src/components/${f}`)));
    if (!usesImage)
      info('IMG-005', 'Alle Bilder sind plain <img> — remotePatterns ist trotzdem Pflicht (Abschnitt 9.4), bricht aber aktuell keinen Build.');
  }
}

/* ---------------------------------------------------------------- *
 * 7. Gerendertes HTML: Marker, Bilder, Verschachtelung
 * ---------------------------------------------------------------- */
const pages = fs.existsSync(path.join(ROOT, 'src/pages'))
  ? fs.readdirSync(path.join(ROOT, 'src/pages')).filter((f) => f.endsWith('.astro')).map((f) => f.replace(/\.astro$/, ''))
  : [];
const htmlFor = (page) => {
  for (const c of [path.join(HTML_DIR, page, 'index.html'), path.join(HTML_DIR, `${page}.html`)]) {
    if (fs.existsSync(c)) return fs.readFileSync(c, 'utf8');
  }
  return null;
};

if (!fs.existsSync(HTML_DIR)) {
  warn('HTM-001', `Kein HTML-Ordner "${path.relative(ROOT, HTML_DIR)}" — Markerprüfung übersprungen. Bitte "npm run build" ausführen.`);
} else {
  const allHtml = pages.map((p) => ({ page: p, html: htmlFor(p) })).filter((x) => x.html);
  if (allHtml.length !== pages.length)
    warn('HTM-002', `Nicht alle ${pages.length} Seiten liegen als HTML vor (gefunden: ${allHtml.length}). Build evtl. veraltet.`);

  const markersByPage = new Map();
  const sectionsSeen = new Set();
  for (const { page, html } of allHtml) {
    markersByPage.set(page, new Set([...html.matchAll(/data-cms-field="([^"]*)"/g)].map((m) => m[1])));
    for (const m of html.matchAll(/data-cms-section="([^"]*)"/g)) sectionsSeen.add(m[1]);
  }
  const allMarkers = new Set([...markersByPage.values()].flatMap((s) => [...s]));

  for (const { page, html } of allHtml) {
    // 7.1 — jeder Marker muss im Manifest existieren
    for (const mk of markersByPage.get(page)) {
      if (mk.includes('${') || mk.includes('CSS.escape')) continue; // Brücken-Lookup
      if (!fieldIds.has(mk))
        err('HTM-003', `/${page}: data-cms-field="${mk}" steht nicht im Manifest → im CMS nicht klickbar.`);
    }
    for (const s of sections) {
      if (s.raw.id && !sectionsSeen.has(s.raw.id))
        err('HTM-004', `Sektion "${s.raw.id}" hat data-cms-section="…" auf keiner Seite.`);
    }
    // 7.1 — Marker am innersten Element
    const nested = findNestedMarkers(html);
    if (nested.length)
      err('HTM-005', `/${page}: data-cms-field auf einem Wrapper, der einen anderen Marker enthält → der innere Marker wird gelöscht (7.1): ${nested.slice(0, 5).join(', ')}`);

    // 5.1 / L5 — Bilder
    const imgs = [...html.matchAll(/<img\b[^>]*>/g)].map((m) => m[0]);
    for (const tag of imgs) {
      const src = /src="([^"]*)"/.exec(tag)?.[1] ?? '';
      const mk = /data-cms-field="([^"]*)"/.exec(tag)?.[1];
      if (/\/images\//.test(src) || /supabase/.test(src)) {
        if (!mk) err('HTM-006', `/${page}: <img src="${src}"> ohne data-cms-field → im CMS nicht austauschbar (Abschnitt 7.1).`);
        else {
          if (/\bsrcset=/.test(tag)) err('HTM-007', `/${page}: <img data-cms-field="${mk}"> hat srcset → bricht die Vorschau (5.1).`);
          if (/\bsizes=/.test(tag)) err('HTM-008', `/${page}: <img data-cms-field="${mk}"> hat sizes → bricht die Vorschau (5.1).`);
        }
      }
      if (!/\balt=/.test(tag)) err('HTM-009', `/${page}: <img src="${src}"> ohne alt-Attribut (L1: alt fest im Template).`);
    }
    if (/<picture\b/.test(html)) err('HTM-010', `/${page}: <picture> vorhanden → bricht die Bildvorschau (5.1).`);
    const bg = [...html.matchAll(/style="[^"]*background-image/gi)];
    if (bg.length) err('HTM-011', `/${page}: ${bg.length} CSS-Hintergrundbild(er) → im CMS nicht austauschbar (L5).`);
  }

  // 11 — Felder ohne Klick-Marker. Bezieht sich auf ALLE Seiten zusammen,
  // wird darum nur einmal gemeldet.
  const missing = [...fieldIds.keys()].filter((id) => !allMarkers.has(id));
  if (missing.length)
    warn(
      'HTM-012',
      `${missing.length} Manifest-Feld(er) ohne Klick-Marker im gesamten HTML (im CMS nur über den Editor änderbar): ${missing.join(', ')}`
    );
}

/* ---------------------------------------------------------------- *
 * Ausgabe
 * ---------------------------------------------------------------- */

function report() {
  const g = (s) => `\x1b[32m${s}\x1b[0m`;
  const y = (s) => `\x1b[33m${s}\x1b[0m`;
  const r = (s) => `\x1b[31m${s}\x1b[0m`;
  const d = (s) => `\x1b[2m${s}\x1b[0m`;
  const w = (s) => `\x1b[1m${s}\x1b[0m`;

  console.log(d(`\ncms-check · Contract: CMS-REFERENCE.md${refVersion ? ` v${refVersion}` : ''}\n`));
  if (refVersion) {
    const pkg = read('package.json');
    console.log(d(`  Felder: ${fieldIds.size} eindeutig · Sektionen: ${sections.length} · Tabs: ${pageFilesByTab.size}\n`));
  }
  for (const i of infos) console.log(d(`  ·  ${i.code} ${i.msg}`));
  if (warnings.length) {
    console.log(y(`  ${warnings.length} Warnung(en):`));
    for (const x of warnings) console.log(y(`  !  ${x.code} ${x.msg}`));
  }
  if (errors.length) {
    console.log(r(`\n  ${errors.length} Fehler:`));
    for (const e of errors) console.log(r(`  ✗  ${e.code} ${e.msg}`));
    console.log(r(`\n  ERGEBNIS: ${errors.length} Fehler — Publish/Preview nicht freigegeben.\n`));
    process.exit(1);
  }
  console.log(g(`\n  0 Fehler${warnings.length ? `, ${warnings.length} Warnung(en)` : ''}.`));
  console.log(g('  ERGEBNIS: Contract erfüllt.\n'));
  process.exit(0);
}
report();
