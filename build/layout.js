// Fills in the parts every page shares, from site.config.js, so a page's HTML holds only its
// own content. Runs in Vite (dev and build) through transformIndexHtml. Markers:
//
//   <!--mag:head-->     charset, viewport, description, title, icons, manifest
//   <!--mag:header-->   skip link, wordmark, nav (current page marked), offline badge
//   <!--mag:error-->    the box shown when a page's data can't load
//   <!--mag:footer-->   back-to-top link, sources and licences, the not-affiliated line
//   <!--mag:cards:feature-->, <!--mag:cards:tool-->   a card per page of that kind
//   <!--mag:sources-->  every source, with its licence (the About page)
//   <!--mag:if-tools--> … <!--/mag:if-tools-->   dropped while there are no tool pages
//   <span data-icon="name"></span>   a Lucide icon, drawn as inline SVG

import * as lucide from 'lucide';

const LICENCES = {
  ogl: {
    name: 'Open Government Licence v3.0',
    url: 'https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/',
    notice: '© Crown copyright.',
  },
  'cc-by-4': { name: 'Creative Commons Attribution 4.0', url: 'https://creativecommons.org/licenses/by/4.0/', notice: '' },
};

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const pascal = (name) => name.replace(/(^|-)([a-z0-9])/g, (_, __, c) => c.toUpperCase());

/** A Lucide icon as an SVG string, hidden from screen readers (the text beside it says it). */
export function iconSvg(name) {
  const node = lucide[pascal(name)];
  if (!node) throw new Error(`No Lucide icon called "${name}"`);
  const parts = node.map(([tag, attrs]) => `<${tag} ${Object.entries(attrs).map(([k, v]) => `${k}="${esc(v)}"`).join(' ')}/>`);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${parts.join('')}</svg>`;
}

/** The header links: Home, then Features and Tools when there are any, then About. */
export function navLinks(site) {
  const kinds = new Set(site.pages.map((p) => p.kind));
  return [
    { href: './', file: 'index.html', label: 'Home', icon: 'house', owns: [] },
    kinds.has('feature') && { href: './features.html', file: 'features.html', label: 'Features', icon: 'newspaper', owns: site.pages.filter((p) => p.kind === 'feature').map((p) => p.file) },
    kinds.has('tool') && { href: './tools.html', file: 'tools.html', label: 'Tools', icon: 'wrench', owns: site.pages.filter((p) => p.kind === 'tool').map((p) => p.file) },
    { href: './about.html', file: 'about.html', label: 'About', icon: 'info', owns: [] },
  ].filter(Boolean);
}

function head(site, page, file) {
  const title = page ? `${page.title} – ${site.name}` : file === 'index.html' ? `${site.name}: ${site.tagline}` : `${pageTitle(file)} – ${site.name}`;
  return `<meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <meta name="theme-color" content="#f3f0e8" />
    <meta name="description" content="${esc(page?.standfirst ?? site.tagline)}" />
    <title>${esc(title)}</title>
    <link rel="icon" href="./favicon.svg" type="image/svg+xml" />
    <link rel="manifest" href="./manifest.webmanifest" />`;
}

const pageTitle = (file) => ({ 'features.html': 'Features', 'tools.html': 'Tools', 'about.html': 'About the data' })[file] ?? file;

function header(site, file) {
  const links = navLinks(site)
    .map((l) => `<a class="mag-nav__link" href="${l.href}"${l.file === file || l.owns.includes(file) ? ' aria-current="page"' : ''}>${esc(l.label)}</a>`)
    .join('\n          ');
  return `<a href="#main-content" class="govuk-skip-link">Skip to main content</a>
    <header class="mag-header" id="top">
      <div class="govuk-width-container mag-header__inner">
        <a href="./" class="mag-header__wordmark">${esc(site.name)}</a>
        <nav class="mag-nav" id="nav" aria-label="Pages">
          ${links}
        </nav>
        <p class="mag-offline" id="offline" role="status" hidden>
          <span class="mag-offline__icon"></span>Offline: showing saved data
        </p>
      </div>
    </header>`;
}

const ERROR = `<div class="govuk-error-summary" id="error" hidden>
          <div role="alert">
            <h2 class="govuk-error-summary__title">This page's data could not be loaded</h2>
            <div class="govuk-error-summary__body">
              <p class="govuk-body" id="error-message"></p>
            </div>
          </div>
        </div>`;

function credit(site, id) {
  const s = site.sources[id];
  if (!s) throw new Error(`site.config.js: no source called "${id}"`);
  return `${esc(s.publisher)}, <a class="govuk-footer__link" href="${esc(s.url)}">${esc(s.title)}</a>`;
}

function licenceLines(site, ids) {
  const used = [...new Set(ids.map((id) => site.sources[id].licence))];
  return used
    .map((key) => {
      const l = LICENCES[key];
      if (!l) throw new Error(`site.config.js: unknown licence "${key}" (add it to LICENCES in build/layout.js)`);
      return `<p class="govuk-body-s">Contains public sector information licensed under the <a class="govuk-footer__link" href="${l.url}" rel="license">${l.name}</a>. ${l.notice}</p>`;
    })
    .join('\n');
}

function footer(site, page) {
  const ids = page ? page.sources : Object.keys(site.sources);
  const publishers = site.publishers.length ? site.publishers.join(', ') : 'the publishers of the data';
  return `<div class="mag-back-to-top">
          <a class="mag-back-to-top__link" href="#top"><span class="mag-back-to-top__icon"></span><span class="govuk-visually-hidden">Back to top</span></a>
        </div>
      </main>
    </div>
    <footer class="govuk-footer mag-footer">
      <div class="govuk-width-container">
        <div class="govuk-footer__meta">
          <div class="govuk-footer__meta-item govuk-footer__meta-item--grow">
            <h2 class="govuk-visually-hidden">About the data</h2>
            <p class="govuk-body-s">Source${ids.length > 1 ? 's' : ''}: ${ids.map((id) => credit(site, id)).join('; ')}.</p>
            ${licenceLines(site, ids)}
            ${ids.map((id) => site.sources[id].notice).filter(Boolean).map((n) => `<p class="govuk-body-s">${esc(n)}</p>`).join('\n')}
            <p class="govuk-body-s">This site is not affiliated with or endorsed by ${esc(publishers)}. Groupings and wording are our own, explained on each page.</p>
          </div>
        </div>
      </div>
    </footer>`;
}

function cards(site, kind) {
  const pages = site.pages.filter((p) => p.kind === kind);
  if (pages.length === 0) return '<p class="govuk-body mag-empty">Nothing here yet.</p>';
  return `<ul class="mag-cards">
${pages
  .map(
    (p) => `  <li class="mag-card">
    <span class="mag-card__icon">${iconSvg(p.icon)}</span>
    <h3 class="govuk-heading-m mag-card__title"><a class="govuk-link mag-card__link" href="./${p.file}">${esc(p.title)}</a></h3>
    <p class="govuk-body">${esc(p.standfirst)}</p>
  </li>`,
  )
  .join('\n')}
</ul>`;
}

function sourceList(site) {
  return `<dl class="govuk-body">
${Object.values(site.sources)
  .map((s) => `  <dt><b>${esc(s.title)}</b></dt>
  <dd>${esc(s.publisher)}. <a class="govuk-link" href="${esc(s.url)}">The data</a>, under the ${esc(LICENCES[s.licence]?.name ?? s.licence)}.</dd>`)
  .join('\n')}
</dl>`;
}

/** Fills in every marker in one page's HTML. `file` is the page's file name, e.g. "example.html". */
export function renderLayout(html, site, file) {
  const page = site.pages.find((p) => p.file === file);
  const hasTools = site.pages.some((p) => p.kind === 'tool');
  return html
    .replace(/<!--mag:if-tools-->([\s\S]*?)<!--\/mag:if-tools-->/g, (_, inner) => (hasTools ? inner : ''))
    .replace('<!--mag:head-->', () => head(site, page, file))
    .replace('<!--mag:header-->', () => header(site, file))
    .replace('<!--mag:error-->', ERROR)
    .replace('<!--mag:footer-->', () => footer(site, page))
    .replace(/<!--mag:cards:(feature|tool)-->/g, (_, kind) => cards(site, kind))
    .replace('<!--mag:sources-->', () => sourceList(site))
    .replace(/<span([^>]*) data-icon="([a-z0-9-]+)"([^>]*)><\/span>/g, (_, a, name, b) => `<span${a}${b}>${iconSvg(name)}</span>`);
}
