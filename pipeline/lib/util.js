// Small helpers every source uses: numbers from spreadsheet cells, header rows, where to read
// and write, and writing JSON.

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

/**
 * A number from a cell, or null for blanks and the publishers' markers ([c] suppressed, [x] not
 * available, [z] not applicable, ":" , "-", ".."). Strips thousands commas and "%" (as a share: 42% → 0.42).
 */
export function num(cell) {
  if (typeof cell === 'number') return Number.isFinite(cell) ? cell : null;
  let s = String(cell ?? '').trim().replace(/,/g, '');
  const pct = s.endsWith('%');
  if (pct) s = s.slice(0, -1);
  if (s === '' || !Number.isFinite(Number(s))) return null;
  return pct ? Number(s) / 100 : Number(s);
}

/** Drops footnote markers from a heading: "Year [note 2]" → "Year". */
export const clean = (cell) => String(cell ?? '').replace(/\s*\[[^\]]*\]/g, '').replace(/\s+/g, ' ').trim();

/**
 * The rows under the header row whose first cell (notes dropped) is `first`, as objects keyed by
 * the cleaned header. Throws if there's no such row, so a changed table fails the build loudly.
 */
export function rowsUnder(rows, first, what) {
  const h = rows.findIndex((r) => clean(r[0]) === first);
  if (h === -1) throw new Error(`${what}: no header row starting "${first}". Has the table changed?`);
  const names = rows[h].map(clean);
  return rows
    .slice(h + 1)
    .filter((r) => r.some((c) => String(c ?? '').trim() !== ''))
    .map((r) => Object.fromEntries(names.map((n, i) => [n, r[i]])));
}

/** Throws unless every column is in the header, naming what's missing. */
export function expectColumns(row, columns, what) {
  const missing = columns.filter((c) => !(c in row));
  if (missing.length) throw new Error(`${what}: missing column${missing.length > 1 ? 's' : ''} ${missing.map((c) => `"${c}"`).join(', ')}`);
}

/**
 * How a source runs, from the command line: 'download' (the default: fetch into .cache/, then
 * read it), 'cached' (read .cache/ only) or 'fixture' (read test/fixtures/, as the tests do).
 */
export const modeOf = (argv = process.argv) => (argv.includes('--fixture') ? 'fixture' : argv.includes('--cached') ? 'cached' : 'download');

/** Where a source reads its files: .cache/<name>/ or test/fixtures/<name>/. */
export const inputDir = (name, mode) => (mode === 'fixture' ? join(ROOT, 'test', 'fixtures', name) : join(ROOT, '.cache', name));

/** Writes public/data/<path> (pretty enough to read, small enough to ship). */
export async function writeJson(path, data) {
  const out = join(ROOT, 'public', 'data', path);
  await mkdir(dirname(out), { recursive: true });
  await writeFile(out, `${JSON.stringify(data)}\n`);
  return out;
}

/** "a-b-c" from "A, B & C". For per-item file names. */
export const slugify = (s) =>
  String(s)
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
