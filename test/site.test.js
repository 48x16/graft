// site.config.js is the wiring for every page: check it agrees with the files on disk.

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { iconSvg, renderLayout } from '../build/layout.js';
import site from '../site.config.js';

const ROOT = join(import.meta.dirname, '..');

describe('site.config.js', () => {
  it('has a name and tagline (no placeholders left)', () => {
    expect(site.name).not.toMatch(/__/);
    expect(site.tagline).not.toMatch(/__/);
  });

  for (const p of site.pages) {
    describe(p.file, () => {
      const html = existsSync(join(ROOT, p.file)) ? readFileSync(join(ROOT, p.file), 'utf8') : '';

      it('exists, uses the shared layout, and loads a script that exists', () => {
        expect(html, `${p.file} is missing`).not.toBe('');
        for (const marker of ['<!--mag:head-->', '<!--mag:header-->', '<!--mag:error-->', '<!--mag:footer-->']) expect(html).toContain(marker);
        const script = /<script type="module" src="\/(src\/[^"]+)"/.exec(html)?.[1];
        expect(script, 'no module script').toBeTruthy();
        expect(existsSync(join(ROOT, script)), `${script} is missing`).toBe(true);
      });

      it('has an h1 matching its title, a known kind, icon and sources', () => {
        expect(html).toContain(`>${p.title}</h1>`);
        expect(['feature', 'tool']).toContain(p.kind);
        expect(() => iconSvg(p.icon)).not.toThrow();
        expect(p.sources.length).toBeGreaterThan(0);
        for (const id of p.sources) expect(site.sources[id], `unknown source "${id}"`).toBeTruthy();
        expect(p.ready).toBeTruthy();
      });

      it('renders with no marker left over', () => {
        expect(renderLayout(html, site, p.file)).not.toMatch(/<!--mag:/);
      });
    });
  }

  it('lists every story page: no page on disk is left out of the config', () => {
    const own = new Set(['index.html', 'features.html', 'tools.html', 'about.html', ...site.pages.map((p) => p.file)]);
    const stray = readdirSync(ROOT).filter((f) => f.endsWith('.html') && !own.has(f));
    expect(stray).toEqual([]);
  });

  it('every source has a licence the layout knows', () => {
    for (const [id, s] of Object.entries(site.sources)) {
      expect(['ogl', 'cc-by-4'], `${id}: licence`).toContain(s.licence);
      expect(s.url).toMatch(/^https:\/\//);
    }
  });
});
