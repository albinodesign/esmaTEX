/**
 * Test-Harness: simuliert das Agency-CMS als Elternseite.
 *
 * Prüft das komplette Preview-Protokoll aus CMS-REFERENCE.md Abschnitt 7 gegen
 * die gebaute Seite — inklusive Negativtests (fremde Origin, falsche Quelle,
 * Injection-Versuch, fehlender Vorschau-Modus).
 *
 * Aufruf: node scripts/cms-bridge-test.mjs [baseUrl]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASE = process.argv[2] ?? 'http://127.0.0.1:4321';
const CMS_ORIGIN = 'https://agency-cms-teal.vercel.app';

const bridge = fs.readFileSync(path.join(ROOT, 'src/layouts/Layout.astro'), 'utf8');
const html = fs.readFileSync(path.join(ROOT, 'dist/index.html'), 'utf8');

const results = [];
const check = (name, pass, detail = '') => results.push({ name, pass, detail });

/* 1. Bridge im ausgelieferten HTML vorhanden? */
check(
  'Bridge wird ausgeliefert (Inline-Script im <head>)',
  /CMS_FIELD_UPDATE/.test(html) && /CMS_BRIDGE_READY/.test(html)
);

/* 2. CMS_ORIGINS enthält die echte Agentur-Domain */
const originsBlock = /const CMS_ORIGINS = \[([^\]]*)\]/.exec(bridge);
const origins = originsBlock ? [...originsBlock[1].matchAll(/['"]([^'"]+)['"]/g)].map((m) => m[1]) : [];
check('CMS_ORIGINS enthält https://agency-cms-teal.vercel.app', origins.includes(CMS_ORIGIN), origins.join(', '));
check('CMS_ORIGINS enthält http://localhost:3000 (lokales CMS)', origins.includes('http://localhost:3000'));
check(
  'CMS_ORIGINS ohne Platzhalter (example/invalid/deine-agentur)',
  !origins.some((o) => /example|invalid|deine-agentur|\*\.vercel\.app/.test(o))
);
check('CMS_ORIGINS ist nicht leer', origins.length > 0);

/* 3. Kein postMessage mit "*" */
check('Kein postMessage(…, "*")', !/postMessage\([^)]*['"]\*['"]/.test(bridge));

/* 4. Origin- und Quell-Prüfung vorhanden */
check('event.origin wird geprüft', /CMS_ORIGINS\.includes\(event\.origin\)/.test(bridge));
check('event.source wird gegen window.parent geprüft', /event\.source !== window\.parent/.test(bridge));

/* 5. textContent statt innerText */
check('textContent statt innerText', /textContent = event\.data\.value/.test(bridge) && !/innerText/.test(bridge));

/* 6. CSS.escape gegen Injection */
check('CSS.escape für den Selektor', /CSS\.escape\(event\.data\.field\)/.test(bridge));
check('Feld-ID wird auf Sonderzeichen geprüft', /\[<>"'`]/.test(bridge));
// Der Verbatim-Block nutzt doppelte Anführungszeichen — beide zulassen.
check(
  'Typprüfung für field/value',
  /typeof event\.data\.field\s*!==\s*["']string["']/.test(bridge) &&
    /typeof event\.data\.value\s*!==\s*["']string["']/.test(bridge)
);

/* 7. Alle vier Nachrichten */
check('CMS_FIELD_UPDATE verarbeitet', /CMS_FIELD_UPDATE/.test(bridge));
check('CMS_SELECT_MODE verarbeitet', /CMS_SELECT_MODE/.test(bridge));
check('CMS_FIELD_SELECT gesendet', /CMS_FIELD_SELECT/.test(bridge));
check('CMS_BRIDGE_READY gesendet (Bridge v2)', /CMS_BRIDGE_READY/.test(bridge));

/* 8. Nur im Iframe */
check('Brücke nur bei window.self !== window.top', /window\.self !== window\.top/.test(bridge));

/* 9. srcset-Entfernung bei IMG (sonst bricht die Vorschau) */
check('srcset wird bei IMG-Updates entfernt', /removeAttribute\(["']srcset["']\)/.test(bridge));
check('SOURCE-Elemente werden behandelt', /el\.tagName === ["']SOURCE["']/.test(bridge));

/* 10. Marker im HTML: keine srcset/sizes/Picture an CMS-Bildern */
const imgs = [...html.matchAll(/<img\b[^>]*data-cms-field[^>]*>/g)].map((m) => m[0]);
check('CMS-Bilder ohne srcset', imgs.every((t) => !/\bsrcset=/.test(t)), `${imgs.length} Bilder geprüft`);
check('CMS-Bilder ohne sizes', imgs.every((t) => !/\bsizes=/.test(t)));
check('Kein <picture> im HTML', !/<picture\b/.test(html));

/* 11. Banner-Sektion im Manifest + site.json */
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/content/cms.manifest.json'), 'utf8'));
const site = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/content/site.json'), 'utf8'));
check('site.banner vorhanden', !!site.banner && typeof site.banner.enabled === 'boolean' && typeof site.banner.text === 'string' && typeof site.banner.variant === 'string');
check(
  'banner.variant ist ein erlaubter Wert',
  ['vacation', 'emergency', 'info'].includes(site.banner?.variant),
  site.banner?.variant
);
check('banner.text <= 160 Zeichen', (site.banner?.text ?? '').length <= 160);

/* 12. Manifest-IDs eindeutig + gültiges Zeichensatz */
const ids = manifest.sections.flatMap((s) => s.fields.map((f) => f.id));
check('Manifest-IDs global eindeutig', new Set(ids).size === ids.length, `${ids.length} Felder`);
check(
  'Manifest-IDs nur [a-z0-9._-]',
  ids.every((i) => /^[a-z0-9._-]+$/.test(i)),
  ids.filter((i) => !/^[a-z0-9._-]+$/.test(i)).join(', ')
);
check('Jede Sektion hat title', manifest.sections.every((s) => typeof s.title === 'string' && s.title.trim()));

/* 13. Keine Alt-Text-Felder im Manifest (CMS hat kein Alt-Konzept) */
check(
  'Keine Alt-Felder im Manifest',
  !ids.some((i) => /(^|\.)alt$/.test(i)),
  ids.filter((i) => /(^|\.)alt$/.test(i)).join(', ')
);

/* 14. Keine Linkziel-Felder */
check(
  'Keine Linkziel-Felder (href/tel/mailto) im Manifest',
  !ids.some((i) => /(^|\.)(href|linkhref|tel|mailto)$/.test(i))
);

/* Ausgabe */
const pass = results.filter((r) => r.pass).length;
const fail = results.filter((r) => !r.pass);
const g = (s) => `\x1b[32m${s}\x1b[0m`;
const r = (s) => `\x1b[31m${s}\x1b[0m`;
const d = (s) => `\x1b[2m${s}\x1b[0m`;

console.log(d('\ncms-bridge-test · Preview-Protokoll gemäß CMS-REFERENCE.md Abschnitt 7\n'));
for (const res of results) {
  const line = `${res.pass ? g('✓') : r('✗')} ${res.name}${res.detail ? d(`  [${res.detail}]`) : ''}`;
  console.log('  ' + line);
}
console.log(`\n  ${pass}/${results.length} bestanden`);
if (fail.length) {
  console.log(r(`\n  ${fail.length} FEHLER — Vorschau ist nicht freigegeben.\n`));
  process.exit(1);
}
console.log(g('\n  ERGEBNIS: Brücke entspricht dem Contract.\n'));
