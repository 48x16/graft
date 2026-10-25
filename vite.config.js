import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { basename } from 'node:path';
import { defineConfig } from 'vite';
import { renderLayout } from './build/layout.js';
import site from './site.config.js';

// The site's own pages, then every page in site.config.js.
const SITE_PAGES = ['index.html', 'features.html', 'tools.html', 'about.html'].filter((f) => existsSync(f));
const PAGES = [...SITE_PAGES, ...site.pages.map((p) => p.file)];
// Files in public/ that belong to the app shell (data/ is cached as it's viewed instead).
const PUBLIC_SHELL = ['manifest.webmanifest', 'favicon.svg'];

/** Header, nav, footer and card lists from site.config.js (see build/layout.js). */
function layout() {
  return {
    name: 'magazine-layout',
    transformIndexHtml: {
      order: 'pre',
      handler: (html, ctx) => renderLayout(html, site, basename(ctx.filename)),
    },
  };
}

/** Emits sw.js with this build's file list, so the precache always matches the hashed names. */
function serviceWorker() {
  return {
    name: 'magazine-service-worker',
    apply: 'build',
    generateBundle(_, bundle) {
      // Fonts ship a file per script; precache the Latin ones, cache any other when first used.
      const latinFont = /(inter|inter-tight)-latin-wght-normal|ibm-plex-mono-latin-(400|600)-normal/;
      const files = Object.keys(bundle).filter((f) => !f.endsWith('.map') && (!f.endsWith('.woff2') || latinFont.test(f)));
      const precache = ['./', ...new Set([...PAGES, ...files, ...PUBLIC_SHELL])].map((f) => (f === './' ? f : `./${f}`));
      const version = createHash('sha256').update(precache.join('\n')).digest('hex').slice(0, 12);
      let source = readFileSync('src/sw.js', 'utf8');
      for (const [line, value] of [
        ["const VERSION = '__VERSION__';", version],
        ['const PRECACHE = __PRECACHE__;', precache],
      ]) {
        if (!source.includes(line)) this.error(`src/sw.js no longer contains "${line}"`);
        source = source.replace(line, line.replace(/'?__[A-Z]+__'?/, JSON.stringify(value)));
      }
      this.emitFile({ type: 'asset', fileName: 'sw.js', source });
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [layout(), serviceWorker()],
  build: {
    rolldownOptions: {
      input: Object.fromEntries(PAGES.map((f) => [f.replace(/\.html$/, ''), f])),
    },
  },
  test: {
    include: ['test/**/*.test.js'],
    environment: 'node',
  },
});
