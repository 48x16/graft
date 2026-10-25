# Graft

Who works, who arrives, and what the official figures say. A static magazine-style web app built from official open data on Work and immigration.
Node pipelines turn source files into small JSON files; Vite builds the pages; d3 draws the
charts. No backend. Built with the `new-magazine` kit (same house style as Rev Counter).

## Commands

```sh
npm run data            # download every source into .cache/, then build public/data/
npm run data:cached     # rebuild public/data/ from .cache/ (offline)
npm run data:fixture    # rebuild from the tiny files in test/fixtures/
node pipeline/run.js <name> [--cached|--fixture]   # one source
npm run dev             # http://localhost:5173
npm test                # vitest unit tests
npm run build && npm run test:e2e   # Playwright + axe (WCAG 2.2 AA), through Edge
npm run check-page -- <page> [--base URL]           # one page: sentences, axe, overflow, errors
```

## How it fits together

- `site.config.js` is the only wiring: every page (file, kind, title, standfirst, icon,
  sources, ready selector) and every source (publisher, title, URL, licence). The header, nav,
  footer credits, home cards, About page, Vite inputs, service worker and e2e tests all read it.
- A page is `<name>.html` (its own content between the `<!--mag:…-->` markers) plus
  `src/feature-<name>.js` (calls `startFeature('<name>', render)`), and optionally
  `src/styles/<name>.scss` imported by that script. Copy `example.html` for the frame.
- A source is `pipeline/sources/<name>.js` exporting `run(mode)` and pure `build…` functions.
  `pipeline/run.js` finds every source; nothing needs wiring. Readers: `pipeline/lib/ods.js`,
  `xlsx.js` (both: `readWorkbook(path)` → `{ names, sheet(name) }`; await `sheet`),
  `csv-parse`, `zip.js` for big zips; `util.js` has `num`, `rowsUnder`, `writeJson`, `slugify`.
- Charts: `src/charts.js` (`bars`, `markedBars`, `tiles`, `heatTable`, `renderTable`,
  `emptyNote`, `formatCount`/`formatPercent`/`formatChange`/`roughly`/`oneIn`/`times`/`lower`/`list`)
  and `src/line-chart.js` (`createChart(root).update({ labels, dates, series, summary })`).
- `docs/briefs/` holds what each dataset is (from the scouts); `docs/plan.md` the editorial plan;
  `docs/decisions.md` every judgement made without asking.

## Content rules

- **Every sentence that states a figure is generated from the data**, so it stays true after
  each update. Never hard-code a number in prose, titles or standfirsts.
- Use the publisher's own terms and say exactly what is counted (applications, decisions,
  grants or people; year ending June 2025; UK or England and Wales).
- Suppressed or missing cells are `null`, never 0. Judge thresholds against small groups.
- Neutral, precise language on sensitive subjects (see `docs/editorial.md`). No deaths or
  casualty counts. No data about identifiable individuals.
- Open Government Licence (or equally open) data only. Check the licence before building.
- House style: light only, sans (Oswald, Inter, IBM Plex Mono), black and grey,
  stamp red `#b3261e` as the one sparing accent, on grainy newsprint `#f3f0e8` with Oswald capitals for headings (the gritty style the user asked for). Never propose dark mode.
- No chart relies on colour alone; every chart has a table or list twin.

## Done means

Unit tests pass. The page renders on real data **and** on fixture data (empty lists must not
crash: use `emptyNote`). axe is clean, no sideways scroll at 360px, no console errors, no
summary containing "undefined" or "NaN". `npm run test:e2e` passes. Local only: no remote, no push.
