import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';
import siteJson from './src/content/site.json';

export default defineConfig({
  site: siteJson.url,
  output: 'static',
  integrations: [tailwind()],
  // CMS-Bilder (Bucket `cms-media`) — Pflicht laut CMS-REFERENCE.md Abschnitt 9.4.
  // Bewusst KEIN Wildcard: der konkrete Supabase-Projekt-Host wird eingetragen.
  image: {
    remotePatterns: [{ protocol: 'https', hostname: '*.supabase.co' }]
  }
});
