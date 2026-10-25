// Support by Area: people receiving Home Office asylum support in each local authority.
// Builds public/data/asylum-support/index.json, one public/data/asylum-support/<slug>.json per
// local authority, and public/data/features/asylum-support.json (the index again, which the
// page's startFeature loads).
//
// Publisher: Home Office, Immigration system statistics data tables ("Asylum and resettlement").
// Table: Data_Asy_D11 in support-local-authority-datasets-<mon>-<yyyy>.xlsx (people on asylum
// support by local authority, support type and accommodation type, as at each quarter end).
// Licence: Open Government Licence v3.0. Cadence: quarterly (late Feb, May, Aug, Nov).
//
// Banding rule (binding, docs/plan.md): every per-area count is a Count object. 10 or more is
// rounded to the nearest 5; 1 to 9 is { n: null, band: 'fewer than 10' }; none is { n: 0 }.
// Region and UK totals are exact. D11 has no suppression of its own (cells go down to 1), so no
// cell is null on input: the nulls come only from banding.

import { readdir, readFile, rm, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { parse } from 'csv-parse/sync';
import { download, fetchText, findLink } from '../lib/fetch.js';
import { readWorkbook } from '../lib/xlsx.js';
import { expectColumns, inputDir, num, ROOT, rowsUnder, slugify, writeJson } from '../lib/util.js';

const SOURCE = 'ho-asylum';
const PAGE = 'asylum-support';
const SHEET = 'Data_Asy_D11';
const FILE = /support-local-authority-datasets-[a-z]+-\d{4}\.xlsx$/i;
const FIXTURE = `support-${SHEET}.csv`;
const PAGE_URL = 'https://www.gov.uk/government/statistical-data-sets/immigration-system-statistics-data-tables';

const COLUMNS = ['Date (as at…)', 'Support Type', 'UK Region / Nation', 'Local Authority', 'LAD Code', 'Accommodation Type', 'People'];
const TREND_START = '2023-06-30'; // after the April 2023 boundary changes, so LAD codes are stable
const LAD = /^[ENSW]\d{8}$/;

/** The six accommodation types, in the page's fixed order, keyed by the publisher's label (lower case). */
export const ACCOMMODATION = [
  ['dispersal accommodation', 'Dispersal accommodation'],
  ['initial accommodation', 'Initial accommodation'],
  ['contingency accommodation - hotel', 'Hotels'],
  ['contingency accommodation - other', 'Other contingency accommodation'],
  ['other accommodation', 'Other accommodation'],
  ['subsistence only', 'Subsistence only'],
];
const HOTEL = 'contingency accommodation - hotel';
const SUBSISTENCE = 'subsistence only';

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** "30 Jun 2026" → "2026-06-30" (throws on anything else, so a changed date format fails loudly). */
export function isoDate(cell) {
  const m = /^(\d{1,2}) ([A-Za-z]{3})[a-z]* (\d{4})$/.exec(String(cell ?? '').trim());
  const month = m ? MONTHS.indexOf(m[2].toLowerCase()) : -1;
  if (month === -1) throw new Error(`${PAGE}: unexpected date "${cell}" in ${SHEET}`);
  return `${m[3]}-${String(month + 1).padStart(2, '0')}-${m[1].padStart(2, '0')}`;
}

/** "2026-06-30" → "30 June 2026". */
export const dateWords = (iso) => `${Number(iso.slice(8))} ${MONTH_NAMES[Number(iso.slice(5, 7)) - 1]} ${iso.slice(0, 4)}`;

/** The quarter end after `iso` ("2023-06-30" → "2023-09-30"). */
function nextQuarter(iso) {
  let y = Number(iso.slice(0, 4));
  let m = Number(iso.slice(5, 7)) + 3;
  if (m > 12) (m -= 12), (y += 1);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return `${y}-${String(m).padStart(2, '0')}-${last}`;
}

/** The binding banding rule: a per-area count → a Count object. */
export function band(n) {
  if (!Number.isInteger(n) || n < 0) throw new Error(`${PAGE}: cannot band ${n}`);
  if (n === 0) return { n: 0, band: null };
  if (n < 10) return { n: null, band: 'fewer than 10' };
  return { n: Math.round(n / 5) * 5, band: null };
}

/**
 * Raw sheet rows (title row, header, data, as arrays of cells) → clean records
 * { date (ISO), region, name, code, accommodation (lower case), people }. Region spellings are
 * normalised to the most common spelling of the same words ("Yorkshire And The Humber" →
 * "Yorkshire and The Humber"). Placeholder rows (`N/A - …` local authorities) are kept, with
 * code null, because they count towards the UK and region totals.
 */
export function readD11(rows) {
  const records = rowsUnder(rows, 'Date (as at…)', `${PAGE} ${SHEET}`);
  if (records.length === 0) throw new Error(`${PAGE}: ${SHEET} has no rows`);
  expectColumns(records[0], COLUMNS, `${PAGE} ${SHEET}`);
  const spellings = new Map(); // lower case → Map(spelling → rows)
  for (const r of records) {
    const s = String(r['UK Region / Nation'] ?? '').trim();
    const k = s.toLowerCase();
    if (!spellings.has(k)) spellings.set(k, new Map());
    spellings.get(k).set(s, (spellings.get(k).get(s) ?? 0) + 1);
  }
  const canonical = new Map([...spellings].map(([k, m]) => [k, [...m].sort((a, b) => b[1] - a[1])[0][0]]));
  return records.map((r) => {
    const people = num(r.People);
    if (people === null || !Number.isInteger(people)) throw new Error(`${PAGE}: ${SHEET} has a non-count People cell "${r.People}"`);
    const code = String(r['LAD Code'] ?? '').trim();
    return {
      date: isoDate(r['Date (as at…)']),
      region: canonical.get(String(r['UK Region / Nation'] ?? '').trim().toLowerCase()),
      name: String(r['Local Authority'] ?? '').trim(),
      code: LAD.test(code) ? code : null,
      accommodation: String(r['Accommodation Type'] ?? '').trim().toLowerCase(),
      people,
    };
  });
}

/**
 * Clean records → { index, areas }: the index.json object and one object per local authority
 * (every LAD code present at the latest date), exactly as the data contract in docs/plan.md.
 */
export function buildAsylumSupport(records) {
  if (records.length === 0) throw new Error(`${PAGE}: no records`);
  const latest = records.reduce((m, r) => (r.date > m ? r.date : m), '');
  if (latest < TREND_START) throw new Error(`${PAGE}: latest date ${latest} is before ${TREND_START}`);

  // Every quarter end from 30 June 2023 to the latest must be in the table.
  const present = new Set(records.map((r) => r.date));
  const dates = [];
  for (let d = TREND_START; d <= latest; d = nextQuarter(d)) {
    if (!present.has(d)) throw new Error(`${PAGE}: ${SHEET} has no rows for ${dateWords(d)}`);
    dates.push(d);
  }
  const recent = records.filter((r) => r.date >= TREND_START);
  const known = new Set(ACCOMMODATION.map(([k]) => k));
  const odd = [...new Set(recent.map((r) => r.accommodation))].filter((a) => !known.has(a));
  if (odd.length) throw new Error(`${PAGE}: unknown accommodation type ${odd.map((a) => `"${a}"`).join(', ')} since ${dateWords(TREND_START)}`);

  const now = records.filter((r) => r.date === latest);
  // Exact totals: every row at the latest date, placeholder rows included.
  const ukTotal = now.reduce((s, r) => s + r.people, 0);
  const regionTotals = new Map();
  for (const r of now) regionTotals.set(r.region, (regionTotals.get(r.region) ?? 0) + r.people);

  // Areas: every LAD code at the latest date, with its name and region there.
  const byCode = new Map();
  for (const r of now.filter((x) => x.code)) {
    const a = byCode.get(r.code);
    if (!a) byCode.set(r.code, { name: r.name, code: r.code, region: r.region });
    else if (a.name !== r.name || a.region !== r.region) throw new Error(`${PAGE}: ${r.code} is both "${a.name}, ${a.region}" and "${r.name}, ${r.region}" on ${dateWords(latest)}`);
  }
  if (byCode.size === 0) throw new Error(`${PAGE}: no local authority codes on ${dateWords(latest)}`);
  const list = [...byCode.values()].sort((a, b) => a.name.localeCompare(b.name, 'en-GB') || a.code.localeCompare(b.code));
  const nameCount = new Map();
  for (const a of list) nameCount.set(slugify(a.name), (nameCount.get(slugify(a.name)) ?? 0) + 1);
  for (const a of list) a.slug = nameCount.get(slugify(a.name)) > 1 ? `${slugify(a.name)}-${a.code.toLowerCase()}` : slugify(a.name);

  // Sum people by code, date and accommodation once.
  const sums = new Map(); // `${code}|${date}|${accommodation}` → people
  for (const r of recent.filter((x) => x.code)) {
    const k = `${r.code}|${r.date}|${r.accommodation}`;
    sums.set(k, (sums.get(k) ?? 0) + r.people);
  }
  const get = (code, date, acc) => sums.get(`${code}|${date}|${acc}`) ?? 0; // no rows at a date = 0 (contract)

  const areas = list.map((a) => {
    const byType = ACCOMMODATION.map(([k, label]) => ({ type: label, n: get(a.code, latest, k) }));
    const total = byType.reduce((s, t) => s + t.n, 0); // unrounded, for the share
    const accommodated = dates.map((d) => ACCOMMODATION.filter(([k]) => k !== SUBSISTENCE).reduce((s, [k]) => s + get(a.code, d, k), 0));
    const totalCount = band(total);
    return {
      slug: a.slug,
      name: a.name,
      code: a.code,
      region: a.region,
      date: dateWords(latest),
      total: totalCount,
      byAccommodation: byType.map((t) => ({ type: t.type, count: band(t.n) })),
      trend: {
        dates: dates.map(dateWords),
        accommodated: accommodated.map(band),
        hotels: dates.map((d) => band(get(a.code, d, HOTEL))),
      },
      regionTotal: regionTotals.get(a.region) ?? null,
      ukTotal,
      // From the unrounded count, so it matches the publisher; null when the total is banded or 0.
      shareOfUk: totalCount.n ? Math.round((total / ukTotal) * 10000) / 10000 : null,
    };
  });

  return {
    // Each area's banded total goes in the index too, for the UK map (one file instead of 346).
    index: {
      updated: dateWords(latest),
      ukTotal,
      areas: list.map(({ slug, name, code, region }, i) => ({ slug, name, code, region, total: areas[i].total })),
    },
    areas,
  };
}

/** The current D11 workbook in `dir` (the newest, if several editions are there). */
async function workbookIn(dir) {
  const files = (await readdir(dir).catch(() => [])).filter((f) => FILE.test(f));
  if (files.length === 0) throw new Error(`${PAGE}: no support-local-authority-datasets-*.xlsx in ${dir}. Run without --cached to download it.`);
  const dated = await Promise.all(files.map(async (f) => ({ f, t: (await stat(join(dir, f))).mtimeMs })));
  return join(dir, dated.sort((a, b) => b.t - a.t)[0].f);
}

/** The D11 sheet as rows of cells: the workbook in real modes, the CSV fixture in fixture mode. */
async function sheetRows(mode) {
  const dir = inputDir(SOURCE, mode);
  if (mode === 'fixture') return parse(await readFile(join(dir, FIXTURE), 'utf8'), { relax_column_count: true, skip_empty_lines: true });
  const wb = await readWorkbook(await workbookIn(dir));
  if (!wb.names.includes(SHEET)) throw new Error(`${PAGE}: no sheet ${SHEET} (has ${wb.names.join(', ')})`);
  return wb.sheet(SHEET);
}

export async function run(mode) {
  if (mode === 'download') {
    const html = await fetchText(PAGE_URL);
    const url = findLink(html, PAGE_URL, FILE);
    const name = decodeURIComponent(new URL(url).pathname.split('/').pop());
    await download(url, join(inputDir(SOURCE, 'cached'), name));
  }
  const { index, areas } = buildAsylumSupport(readD11(await sheetRows(mode)));
  await rm(join(ROOT, 'public', 'data', PAGE), { recursive: true, force: true }); // no stale area files
  await writeJson(`${PAGE}/index.json`, index);
  for (const a of areas) await writeJson(`${PAGE}/${a.slug}.json`, a);
  await writeJson(`features/${PAGE}.json`, index);
  return `${areas.length} local authorities on ${index.updated} (${mode})`;
}
