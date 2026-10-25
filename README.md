# Graft

Who works, who arrives, and what the official figures say.

A static, installable web app of stories and tools about Work and immigration, built from official open
data. Every figure in the text is written from the data, so it stays true after each update.

## Run it

```sh
npm install
npm run data        # download the sources and build public/data/ (or data:cached, offline)
npm run dev         # http://localhost:5173
```

Checks: `npm test`, then `npm run build && npm run test:e2e`.

## Data sources and licences

See the About page (`about.html`), generated from `site.config.js`, and `docs/briefs/` for what
each dataset contains. All sources are published under the Open Government Licence v3.0 unless
stated otherwise there.
