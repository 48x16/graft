// Reads sheets of an Excel workbook (.xlsx) as rows of strings, like ods.js does for .ods: an
// .xlsx file is a zip of XML parts. Plain grids only: no styles, merged cells or formulas (a
// formula cell gives its cached value). Dates come through as Excel serial numbers: convert
// them with `excelDate`. Empty rows are kept, so row positions match the sheet.

import { listEntries, openEntry } from './zip.js';

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
const decode = (s) =>
  s.replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (m, e) =>
    e[0] === '#' ? String.fromCodePoint(e[1] === 'x' ? parseInt(e.slice(2), 16) : Number(e.slice(1))) : (ENTITIES[e] ?? m),
  );
const attr = (tag, name) => {
  const m = new RegExp(`\\b${name}="([^"]*)"`).exec(tag);
  return m ? decode(m[1]) : undefined;
};
/** The text of every <t> in a string item (rich text is split into runs). */
const textOf = (xml) => decode([...xml.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)].map((m) => m[1]).join(''));

/** "AB12" → 27 (zero-based column index). */
export function columnIndex(ref) {
  const letters = /^[A-Z]+/.exec(ref)?.[0] ?? 'A';
  return [...letters].reduce((n, c) => n * 26 + c.charCodeAt(0) - 64, 0) - 1;
}

/** An Excel serial date (days since 1899-12-30) as a JavaScript Date (UTC). */
export const excelDate = (serial) => new Date(Date.UTC(1899, 11, 30) + Number(serial) * 86_400_000);

export function parseSharedStrings(xml) {
  return [...xml.matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g)].map((m) => textOf(m[1]));
}

/** Parses one worksheet's XML into rows of strings. Trailing empty cells and rows are dropped. */
export function parseWorksheet(xml, shared = []) {
  const rows = [];
  const rowRe = /<row\b([^>]*?)(?:\/>|>([\s\S]*?)<\/row>)/g;
  const cellRe = /<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g;
  for (const [, rowAttrs, inner = ''] of xml.matchAll(rowRe)) {
    const r = Number(attr(rowAttrs, 'r') ?? rows.length + 1) - 1;
    while (rows.length < r) rows.push([]);
    const cells = [];
    for (const [, cellAttrs, cellInner = ''] of inner.matchAll(cellRe)) {
      const ref = attr(cellAttrs, 'r');
      const i = ref ? columnIndex(ref) : cells.length;
      while (cells.length < i) cells.push('');
      const type = attr(cellAttrs, 't');
      const v = /<v>([\s\S]*?)<\/v>/.exec(cellInner)?.[1];
      let value = '';
      if (type === 's') value = shared[Number(v)] ?? '';
      else if (type === 'inlineStr') value = textOf(cellInner);
      else if (type === 'b') value = v === '1' ? 'TRUE' : 'FALSE';
      else if (v !== undefined) value = decode(v);
      cells[i] = value;
    }
    while (cells.length && cells.at(-1) === '') cells.pop();
    rows[r] = cells;
  }
  while (rows.length && rows.at(-1).length === 0) rows.pop();
  return rows;
}

async function readEntry(path, entries, name) {
  const entry = entries.find((e) => e.name === name);
  if (!entry) return null;
  let xml = '';
  for await (const chunk of (await openEntry(path, entry)).setEncoding('utf8')) xml += chunk;
  return xml;
}

/**
 * Opens an .xlsx file once, for reading several sheets: `names` lists its sheets, in order, and
 * `sheet(name)` parses one (async, as each sheet is read from the zip when asked for).
 */
export async function readWorkbook(path) {
  const entries = await listEntries(path);
  const workbook = await readEntry(path, entries, 'xl/workbook.xml');
  if (!workbook) throw new Error(`${path} is not an Excel workbook`);
  const rels = (await readEntry(path, entries, 'xl/_rels/workbook.xml.rels')) ?? '';
  const targets = Object.fromEntries([...rels.matchAll(/<Relationship\b([^>]*)\/?>/g)].map(([, a]) => [attr(a, 'Id'), attr(a, 'Target')]));
  const sheets = [...workbook.matchAll(/<sheet\b([^>]*)\/?>/g)].map(([, a]) => {
    const target = targets[attr(a, 'r:id')] ?? '';
    return { name: attr(a, 'name'), part: target.startsWith('/') ? target.slice(1) : `xl/${target.replace(/^\.\//, '')}` };
  });
  const shared = parseSharedStrings((await readEntry(path, entries, 'xl/sharedStrings.xml')) ?? '');
  return {
    names: sheets.map((s) => s.name),
    async sheet(name) {
      const s = sheets.find((x) => x.name === name);
      if (!s) throw new Error(`${path}: no sheet named "${name}" (has ${sheets.map((x) => x.name).join(', ')})`);
      return parseWorksheet(await readEntry(path, entries, s.part), shared);
    },
  };
}
