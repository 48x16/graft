// Loads the JSON the pipelines write to public/data/.

async function getJson(path) {
  const res = await fetch(new URL(path, document.baseURI));
  if (!res.ok) throw new Error(`Couldn't load ${path} (${res.status}). Run the data pipeline first: npm run data:cached`);
  return res.json();
}

/** One page's data: public/data/features/<name>.json. */
export const loadFeature = (name) => getJson(`data/features/${name}.json`);

/** One item of a lookup tool: public/data/<folder>/<slug>.json (and index.json lists them). */
export const loadItem = (folder, slug) => getJson(`data/${folder}/${slug}.json`);
