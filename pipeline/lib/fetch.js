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

/** Waits this long before each retry. ONS answers 429 when several files are fetched close together. */
const RETRY_WAITS = [5_000, 15_000, 45_000, 90_000];
const RETRY_ON = new Set([429, 502, 503, 504]);

/** GET, retrying busy or rate-limited answers (honouring Retry-After when given). Throws on any other failure. */
async function get(url) {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url, { headers: HEADERS });
    if (res.ok) return res;
    if (!RETRY_ON.has(res.status) || attempt >= RETRY_WAITS.length) throw new Error(`GET ${url} failed: ${res.status} ${res.statusText}`);
    const after = Number(res.headers.get('retry-after'));
    const wait = Number.isFinite(after) && after > 0 ? Math.min(after * 1000, 120_000) : RETRY_WAITS[attempt];
    console.warn(`GET ${url}: ${res.status}, retrying in ${wait / 1000}s`);
    await res.body?.cancel();
    await new Promise((resolve) => setTimeout(resolve, wait));
  }
}

export async function fetchText(url) {
  return (await get(url)).text();
}

export async function download(url, dest) {
  const res = await get(url);
  await mkdir(dirname(dest), { recursive: true });
  await pipeline(Readable.fromWeb(res.body), createWriteStream(dest));
  return dest;
}
