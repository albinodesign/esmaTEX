import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';
import siteJson from './src/content/site.json';

export default defineConfig({
  site: siteJson.url,
  output: 'static',
  integrations: [tailwind()],
  image: {
    domains: ['supabase.co', '*.supabase.co']
  }
});
