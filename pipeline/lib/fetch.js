// Downloads, and finding download links on GOV.UK and ONS pages. The /media/<id>/ part of a
// GOV.UK file's URL changes with every edition, so links are looked up on the page each time.

import { createWriteStream } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

const HEADERS = { 'user-agent': 'magazine-data-pipeline (open data; contact via the site)' };

/** Every file link on a page (absolute URLs), optionally only those matching `pattern`. */
export function findLinks(html, base, pattern = /\.(csv|ods|xlsx|xls|zip)(\?|$)/i) {
  const urls = [...html.matchAll(/href="([^"]+)"/g)].map((m) => new URL(m[1].replace(/&amp;/g, '&'), base).href);
  return [...new Set(urls)].filter((u) => pattern.test(u));
}

/**
 * The one link on the page whose file name matches `fileName` (a string, matched exactly at the
 * end of the path, or a RegExp, for names with a date in them). Throws on none or several.
 */
export function findLink(html, base, fileName) {
  // ONS links name the file in a query (/file?uri=/…/current/name.xlsx), GOV.UK ones in the path.
  const pathOf = (u) => {
    const url = new URL(u);
    return decodeURIComponent(url.searchParams.get('uri') ?? url.pathname);
  };
  const test = typeof fileName === 'string' ? (u) => pathOf(u).endsWith(`/${fileName}`) : (u) => fileName.test(pathOf(u));
  const urls = findLinks(html, base, /./).filter(test);
  if (urls.length === 0) throw new Error(`No link to ${fileName} on ${base}`);
  if (urls.length > 1) throw new Error(`Several links to ${fileName} on ${base}: ${urls.join(', ')}`);
  return urls[0];
}

export async function fetchText(url) {
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) throw new Error(`GET ${url} failed: ${res.status} ${res.statusText}`);
  return res.text();
}

export async function download(url, dest) {
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) throw new Error(`GET ${url} failed: ${res.status} ${res.statusText}`);
  await mkdir(dirname(dest), { recursive: true });
  await pipeline(Readable.fromWeb(res.body), createWriteStream(dest));
  return dest;
}
