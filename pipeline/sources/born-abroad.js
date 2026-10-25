// Born Abroad: people in work in the UK by country of birth and by nationality, for the latest
// calendar quarter in every year. Builds public/data/features/born-abroad.json.
//
// Publisher: Office for National Statistics. Dataset EMP06 "Employment by country of birth and
// nationality" (Labour Force Survey, UK, not seasonally adjusted; official statistics, not
// accredited). Sheets read: "Country of birth levels" (CDIDs MGTM, JF6F, JF6G, EQ4Q, EQ4S;
// people aged 16+), "Country of birth rates" (LF9D, LFM6, LFM7, EQ4Y, EQ52; aged 16 to 64) and
// "Nationality Levels" (JF6H, JF6I). The file is old binary Excel, read with lib/xls.js.
// Licence: Open Government Licence v3.0. Updates quarterly (February, May, August, November);
// the file name changes each edition (emp06aug2026.xls), so the link is found on the page.

import { readdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { download, fetchText, findLinks } from '../lib/fetch.js';
import { inputDir, num, writeJson } from '../lib/util.js';
import { readWorkbook } from '../lib/xls.js';

const SOURCE = 'ons-birth';
const PAGE_ID = 'born-abroad';
const PAGE = 'https://www.ons.gov.uk/employmentandlabourmarket/peopleinwork/employmentandemployeetypes/datasets/employmentbycountryofbirthandnationalityemp06';
// ONS links its files as /file?uri=/…/current/emp06aug2026.xls, so the whole URL is matched
// (findLink in lib/fetch.js only looks at the path, which is "/file").
const FILE = /\/current\/(emp06[a-z]{3}\d{4}\.xls)$/i;

/** The current edition's URL and file name, from the dataset page's HTML. */
export function currentFile(html, base = PAGE) {
  const hits = findLinks(html, base, /./)
    .map((url) => ({ url, m: FILE.exec(decodeURIComponent(url)) }))
    .filter((h) => h.m);
  const names = [...new Set(hits.map((h) => h.m[1]))];
  if (names.length !== 1) throw new Error(`${SOURCE}: expected one current/emp06….xls link on ${base}, found ${names.length ? names.join(', ') : 'none'}`);
  return { url: hits[0].url, name: names[0] };
}

const SHEETS = { levels: 'Country of birth levels', rates: 'Country of birth rates', nationality: 'Nationality Levels' };
// Contract key → CDID, per sheet. Total EU appears twice in each sheet (columns D and G): the
// first occurrence (column D) is used and the duplicate ignored, never added.
const CDIDS = {
  levels: { total: 'MGTM', ukBorn: 'JF6F', nonUkBorn: 'JF6G', euBorn: 'EQ4Q', nonEuBorn: 'EQ4S' },
  rates: { total: 'LF9D', ukBorn: 'LFM6', nonUkBorn: 'LFM7', euBorn: 'EQ4Y', nonEuBorn: 'EQ52' },
  nationality: { uk: 'JF6H', nonUk: 'JF6I' },
};
// What each sheet's title must say, so a re-cut table fails loudly rather than mislabelling.
const TITLES = {
  levels: /employment levels by country of birth: people aged 16 and over/i,
  rates: /employment rates by country of birth: people aged 16 to 64/i,
  nationality: /employment levels by nationality: people aged 16 and over/i,
};

const QUARTER = /^([A-Z][a-z]{2})-([A-Z][a-z]{2}) (\d{4})/; // footnote digits after the year are dropped
const MONTHS = { Jan: 'January', Feb: 'February', Mar: 'March', Apr: 'April', May: 'May', Jun: 'June', Jul: 'July', Aug: 'August', Sep: 'September', Oct: 'October', Nov: 'November', Dec: 'December' };
const CALENDAR_QUARTERS = ['Jan-Mar', 'Apr-Jun', 'Jul-Sep', 'Oct-Dec'];

/** "Jan-Mar 20197" → { quarter: 'Jan-Mar', year: 2019 }, or null for any other row. */
export function parseQuarter(cell) {
  const m = QUARTER.exec(String(cell ?? '').trim());
  if (!m) return null;
  const quarter = `${m[1]}-${m[2]}`;
  if (!CALENDAR_QUARTERS.includes(quarter)) throw new Error(`${SOURCE}: "${cell}" is not a calendar quarter. Has the table changed?`);
  return { quarter, year: Number(m[3]) };
}

/** "Apr-Jun" → "April to June". */
export const quarterLabel = (q) => q.split('-').map((m) => MONTHS[m]).join(' to ');

/**
 * Caution flag per year, as the plan sets it: "pandemic" for 2020 to 2022 (ONS: extreme caution,
 * non-response by people born abroad), "reweight" for 2019 (the first year at or after the
 * Jan-Mar 2019 reweighting step, whichever quarter is shown), otherwise "none".
 */
export const caution = (year) => (year >= 2020 && year <= 2022 ? 'pandemic' : year === 2019 ? 'reweight' : 'none');

/**
 * One data sheet (rows of cells) → { title, byQuarter: Map('Apr-Jun 2026' → { key: value }) } for
 * the CDIDs asked for. Markers ("*" too small a sample, ".." not available) become null.
 */
export function readSeries(rows, codes, sheetName, titlePattern) {
  const title = String(rows[0]?.[0] ?? '');
  if (titlePattern && !titlePattern.test(title)) throw new Error(`${SOURCE}: sheet "${sheetName}" has the title "${title}". Has the table changed?`);
  const h = rows.findIndex((r) => String(r[0] ?? '').trim() === 'Dataset identifier code');
  if (h === -1) throw new Error(`${SOURCE}: sheet "${sheetName}" has no "Dataset identifier code" row. Has the table changed?`);
  const header = rows[h].map((c) => String(c ?? '').trim());
  const cols = {};
  const missing = [];
  for (const [key, code] of Object.entries(codes)) {
    const i = header.indexOf(code); // first occurrence only (Total EU is repeated in column G)
    if (i === -1) missing.push(code);
    cols[key] = i;
  }
  if (missing.length) throw new Error(`${SOURCE}: sheet "${sheetName}" is missing CDID${missing.length > 1 ? 's' : ''} ${missing.join(', ')}`);
  const byQuarter = new Map();
  for (const r of rows.slice(h + 1)) {
    const q = parseQuarter(r[0]);
    if (!q) continue;
    const id = `${q.quarter} ${q.year}`;
    if (byQuarter.has(id)) throw new Error(`${SOURCE}: sheet "${sheetName}" has ${id} twice`);
    byQuarter.set(id, { ...q, values: Object.fromEntries(Object.entries(cols).map(([k, i]) => [k, num(r[i])])) });
  }
  if (byQuarter.size === 0) throw new Error(`${SOURCE}: sheet "${sheetName}" has no quarter rows`);
  return byQuarter;
}

const round = (v, dp) => (v === null ? null : Math.round(v * 10 ** dp) / 10 ** dp);

/**
 * The page's data from the three sheets' rows: { levels, rates, nationality } (arrays of rows as
 * lib/xls.js returns them). Every series uses the calendar quarter of the latest row in the
 * levels sheet, once per year. Levels are whole people (the cells hold people, though the sheet
 * says thousands); rates are fractions (the sheet's per cent ÷ 100). Nulls stay null.
 */
export function buildBornAbroad(sheets) {
  const series = Object.fromEntries(Object.keys(SHEETS).map((k) => {
    if (!sheets[k]) throw new Error(`${SOURCE}: no rows for sheet "${SHEETS[k]}"`);
    return [k, readSeries(sheets[k], CDIDS[k], SHEETS[k], TITLES[k])];
  }));
  const latest = [...series.levels.values()].at(-1);
  for (const k of ['rates', 'nationality']) {
    const last = [...series[k].values()].at(-1);
    if (last.quarter !== latest.quarter || last.year !== latest.year) throw new Error(`${SOURCE}: "${SHEETS[k]}" ends at ${last.quarter} ${last.year} but "${SHEETS.levels}" at ${latest.quarter} ${latest.year}`);
  }
  const years = [...series.levels.values()].filter((q) => q.quarter === latest.quarter).map((q) => q.year).sort((a, b) => a - b);
  const pick = (k, key, dp, scale = 1) =>
    years.map((y) => {
      const v = series[k].get(`${latest.quarter} ${y}`)?.values[key] ?? null; // a year missing from one sheet → null
      return v === null ? null : round(v / scale, dp);
    });
  const label = quarterLabel(latest.quarter);
  return {
    updated: `${label} ${latest.year}`,
    quarter: latest.quarter,
    quarterLabel: label,
    years,
    caution: years.map(caution),
    levels: Object.fromEntries(Object.keys(CDIDS.levels).map((key) => [key, pick('levels', key, 0)])),
    rates: Object.fromEntries(Object.keys(CDIDS.rates).map((key) => [key, pick('rates', key, 6, 100)])),
    nationality: Object.fromEntries(Object.keys(CDIDS.nationality).map((key) => [key, pick('nationality', key, 0)])),
  };
}

/** The EMP06 file in a folder: the newest edition by the month and year in its name. */
export function pickFile(names) {
  const order = Object.keys(MONTHS).map((m) => m.toLowerCase());
  const files = names
    .map((n) => ({ n, m: /^emp06([a-z]{3})(\d{4})\.xls$/i.exec(n) }))
    .filter((f) => f.m && order.includes(f.m[1].toLowerCase()))
    .sort((a, b) => Number(a.m[2]) - Number(b.m[2]) || order.indexOf(a.m[1].toLowerCase()) - order.indexOf(b.m[1].toLowerCase()));
  return files.at(-1)?.n ?? null;
}

async function fetchCurrent(dir) {
  const { url, name } = currentFile(await fetchText(PAGE));
  await download(url, join(dir, name));
  // Drop older editions so the cache holds exactly what the page was built from.
  for (const old of await readdir(dir)) if (old !== name && /^emp06.*\.xls$/i.test(old)) await rm(join(dir, old));
}

export async function run(mode) {
  const dir = inputDir(SOURCE, mode);
  if (mode === 'download') await fetchCurrent(dir);
  const file = pickFile(await readdir(dir));
  if (!file) throw new Error(`${SOURCE}: no emp06<mon><year>.xls in ${dir}`);
  const book = await readWorkbook(join(dir, file));
  const sheets = {};
  for (const [k, name] of Object.entries(SHEETS)) {
    if (!book.names.includes(name)) throw new Error(`${SOURCE}: ${file} has no sheet "${name}" (has ${book.names.join(', ')})`);
    sheets[k] = await book.sheet(name);
  }
  const data = buildBornAbroad(sheets);
  await writeJson(`features/${PAGE_ID}.json`, data);
  return `${data.years.length} years of ${data.quarter} to ${data.updated} from ${file} (${mode})`;
}
