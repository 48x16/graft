// Boats and Returns: builds public/data/features/small-boats.json for small-boats.html.
//
// Publisher: Home Office, Immigration system statistics data tables (quarterly; this shape
// checked against the year ending June 2026 edition, published 27 August 2026).
// - ho-irregular ("Illegal entry routes"): summary ODS tables IER_02a (small boat arrivals and
//   boats by month) and IER_02d (asylum claims and NRM referrals by arrival year; updates yearly),
//   and the dataset XLSX sheet Data_IER_D01 (detected arrivals by method, nationality, sex, age).
// - ho-returns ("Returns"): dataset XLSX sheet Data_Ret_D01 (returns by return type group) and
//   summary ODS table Ret_06a (returns of small boat arrivals by quarter).
// Licence: Open Government Licence v3.0. Cadence: quarterly (late Feb, May, Aug, Nov).
// Not read: foreign national offender tables (Ret_D03/D04, Ret_02c/d), NRM outcome tables, and
// nothing about deaths.

import { existsSync } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parse } from 'csv-parse/sync';
import { download, fetchText, findLink } from '../lib/fetch.js';
import { readWorkbook as readOds } from '../lib/ods.js';
import { readWorkbook as readXlsx } from '../lib/xlsx.js';
import { clean, expectColumns, inputDir, num, rowsUnder, writeJson } from '../lib/util.js';

const NAME = 'small-boats';
const PAGE = 'https://www.gov.uk/government/statistical-data-sets/immigration-system-statistics-data-tables';
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

// Each input: the source folder, a pattern for the edition's file name, and the sheets read.
const FILES = {
  irregularSummary: { source: 'ho-irregular', pattern: /illegal-entry-routes-to-the-uk-summary-([a-z]+)-(\d{4})-tables\.ods$/i },
  irregularData: { source: 'ho-irregular', pattern: /illegal-entry-routes-to-the-uk-dataset-([a-z]+)-(\d{4})\.xlsx$/i },
  returnsSummary: { source: 'ho-returns', pattern: /returns-summary-([a-z]+)-(\d{4})-tables\.ods$/i },
  returnsData: { source: 'ho-returns', pattern: /returns-datasets-([a-z]+)-(\d{4})\.xlsx$/i },
};

// ---------------------------------------------------------------- periods

const QUARTER = /^(\d{4}) Q([1-4])/;
const qIndex = (y, q) => y * 4 + (q - 1);
const parseQuarter = (s) => {
  const m = QUARTER.exec(String(s ?? '').trim());
  return m ? { year: Number(m[1]), q: Number(m[2]) } : null;
};
/** The four quarters of the year ending June Y: Y-1 Q3, Y-1 Q4, Y Q1, Y Q2. */
const yeJuneQuarters = (y) => [qIndex(y - 1, 3), qIndex(y - 1, 4), qIndex(y, 1), qIndex(y, 2)];
const yeLabel = (y) => `year ending June ${y}`;

/** Years ending June whose four quarters are all present in `quarterSet` (oldest first). */
function completeYearsEndingJune(quarterSet) {
  const qs = [...quarterSet];
  if (!qs.length) return [];
  const first = Math.floor(Math.min(...qs) / 4);
  const last = Math.floor(Math.max(...qs) / 4);
  const out = [];
  for (let y = first; y <= last; y++) if (yeJuneQuarters(y).every((q) => quarterSet.has(q))) out.push(y);
  return out;
}

// ---------------------------------------------------------------- tables

/** Rows under the header row starting `first`, with the named columns checked. */
function table(rows, first, columns, what) {
  const data = rowsUnder(rows, first, what);
  if (!data.length) throw new Error(`${what}: no data rows under the header`);
  expectColumns(data[0], columns, what);
  return data;
}

const round = (x, dp) => (x === null || !Number.isFinite(x) ? null : Math.round(x * 10 ** dp) / 10 ** dp);

// ---------------------------------------------------------------- IER_02a: months

/**
 * IER_02a rows (the sheet as rows of cells) → { months, perBoat }. Blank months (not yet
 * published) are null. A year missing from the table is kept as a row of nulls so the heat table
 * has no gaps, and left out of perBoat.
 */
export function buildMonths(rows) {
  const data = table(rows, 'Year', ['Year', ...MONTHS], 'IER_02a');
  const byYear = new Map();
  for (const r of data) {
    const m = /^(\d{4}) (arrivals|boats)$/i.exec(clean(r.Year));
    if (!m) continue; // footnote rows
    const year = Number(m[1]);
    if (!byYear.has(year)) byYear.set(year, { arrivals: null, boats: null });
    byYear.get(year)[m[2].toLowerCase()] = MONTHS.map((mo) => num(r[mo]));
  }
  if (!byYear.size) throw new Error('IER_02a: no "YYYY arrivals" / "YYYY boats" rows. Has the table changed?');
  const found = [...byYear.keys()].sort((a, b) => a - b);
  const years = [];
  for (let y = found[0]; y <= found.at(-1); y++) years.push(y);
  const blank = () => MONTHS.map(() => null);
  const arrivals = years.map((y) => byYear.get(y)?.arrivals ?? blank());
  const boats = years.map((y) => byYear.get(y)?.boats ?? blank());

  const perBoat = [];
  years.forEach((year, i) => {
    const known = arrivals[i].map((v, m) => (v !== null ? m : -1)).filter((m) => m >= 0);
    if (!known.length) return; // a missing year
    const lastMonth = Math.max(...known);
    const people = arrivals[i].reduce((s, v) => s + (v ?? 0), 0);
    const b = boats[i].reduce((s, v) => s + (v ?? 0), 0);
    perBoat.push({
      year,
      label: lastMonth === 11 ? String(year) : `January to ${MONTHS[lastMonth]} ${year}`,
      people,
      boats: b,
      perBoat: b > 0 ? round(people / b, 1) : null,
    });
  });
  return { months: { years, arrivals, boats }, perBoat };
}

// ---------------------------------------------------------------- Data_IER_D01: arrivals

const SMALL_BOAT = 'Small boat arrivals';
const METHODS = {
  smallBoat: SMALL_BOAT,
  air: 'Inadequately documented air arrivals',
  inCountry: 'Recorded detections in the UK',
  ports: 'Recorded detections at UK ports',
};
const NOT_RECORDED = 'Not currently recorded';

/**
 * Data_IER_D01 rows → years ending June, small boat arrivals per year, and the latest year's
 * detections by method, nationalities, and age and sex. The dataset has no suppression: a
 * nationality absent from a year had no detected arrivals, so its `previous` is a real 0 (null
 * only when there is no previous year).
 */
export function buildArrivals(rows) {
  const cols = ['Quarter', 'Method of entry', 'Nationality', 'Sex', 'Age Group', 'Number of detections'];
  const data = table(rows, 'Year', cols, 'Data_IER_D01');
  const methodNames = new Set(data.map((r) => String(r['Method of entry']).trim()));
  for (const m of Object.values(METHODS)) if (!methodNames.has(m)) throw new Error(`Data_IER_D01: no "${m}" rows. Has the method of entry changed?`);

  const recs = data.map((r) => {
    const q = parseQuarter(r.Quarter);
    if (!q) throw new Error(`Data_IER_D01: can't read quarter "${r.Quarter}"`);
    return {
      qi: qIndex(q.year, q.q),
      method: String(r['Method of entry']).trim(),
      nationality: String(r.Nationality).trim(),
      sex: String(r.Sex).trim(),
      age: String(r['Age Group']).trim(),
      n: num(r['Number of detections']) ?? 0, // no suppression in this dataset; blanks count as 0
    };
  });
  const quarterSet = new Set(recs.map((r) => r.qi));
  const yearList = completeYearsEndingJune(quarterSet);
  if (!yearList.length) throw new Error('Data_IER_D01: no complete year ending June');
  const latest = yearList.at(-1);
  const inYear = (y) => {
    const qs = new Set(yeJuneQuarters(y));
    return (r) => qs.has(r.qi);
  };
  const sum = (list) => list.reduce((s, r) => s + r.n, 0);
  const boatsIn = (y) => recs.filter((r) => r.method === SMALL_BOAT && inYear(y)(r));

  const years = yearList.map((y) => ({ year: y, label: yeLabel(y), provisional: y === latest }));
  const arrivals = yearList.map((y) => sum(boatsIn(y)));

  const latestRecs = recs.filter(inYear(latest));
  const detections = Object.fromEntries(Object.entries(METHODS).map(([k, m]) => [k, sum(latestRecs.filter((r) => r.method === m))]));

  const byNationality = (list) => {
    const out = new Map();
    for (const r of list) out.set(r.nationality, (out.get(r.nationality) ?? 0) + r.n);
    return out;
  };
  const now = byNationality(boatsIn(latest));
  const prevYear = yearList.length > 1 ? yearList.at(-2) : null;
  const before = prevYear === null ? null : byNationality(boatsIn(prevYear));
  const nationalities = [...now]
    .filter(([name]) => name !== NOT_RECORDED)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 10)
    .map(([name, n]) => ({ name, arrivals: n, previous: before === null ? null : (before.get(name) ?? 0) }));

  const latestBoats = boatsIn(latest);
  const ageSex = {
    male: sum(latestBoats.filter((r) => r.sex === 'Male')),
    female: sum(latestBoats.filter((r) => r.sex === 'Female')),
    unknownSex: sum(latestBoats.filter((r) => r.sex === 'Unknown' || r.sex === NOT_RECORDED)),
    under18: sum(latestBoats.filter((r) => r.age === '17 and under')),
  };
  return { years, arrivals, detections, nationalities, notRecorded: now.get(NOT_RECORDED) ?? 0, ageSex };
}

// ---------------------------------------------------------------- IER_02d: claims

const CLAIM_ROWS = {
  total: 'Total arrivals',
  asylumOnly: 'with asylum claim only',
  asylumAndNrm: 'with an asylum claim and an NRM referral',
  neither: 'with no asylum claim and no NRM referral',
};

/** IER_02d rows → one entry per arrival year, shares as fractions of that year's arrivals. */
export function buildClaimed(rows) {
  const data = table(rows, 'Year', ['Year'], 'IER_02d');
  const row = (label) => {
    const r = data.find((x) => clean(x.Year).toLowerCase() === label.toLowerCase());
    if (!r) throw new Error(`IER_02d: no row "${label}". Has the table changed?`);
    return r;
  };
  const rowsBy = Object.fromEntries(Object.entries(CLAIM_ROWS).map(([k, label]) => [k, row(label)]));
  const years = Object.keys(data[0]).filter((k) => /^\d{4}$/.test(k)).map(Number).sort((a, b) => a - b);
  if (!years.length) throw new Error('IER_02d: no year columns');
  return years.map((year) => {
    const total = num(rowsBy.total[year]);
    const share = (k) => {
      const v = num(rowsBy[k][year]);
      return v === null || !total ? null : round(v / total, 4);
    };
    return { year, asylumOnly: share('asylumOnly'), asylumAndNrm: share('asylumAndNrm'), neither: share('neither'), arrivals: total };
  });
}

// ---------------------------------------------------------------- Data_Ret_D01: returns

const RETURN_GROUPS = {
  enforced: 'enforced return',
  voluntary: 'voluntary return',
  refusedAtPort: 'refused entry at port and subsequently departed',
};
const PROVISIONAL_QUARTERS = 7; // Home Office returns note 4

/** Data_Ret_D01 rows → returns by type group, years ending June (group names case-normalised). */
export function buildReturns(rows) {
  const data = table(rows, 'Year', ['Quarter', 'Return type group', 'Number of returns'], 'Data_Ret_D01');
  const totals = new Map(); // qi → { enforced, voluntary, refusedAtPort }
  const known = new Map(Object.entries(RETURN_GROUPS).map(([k, v]) => [v, k]));
  const seen = new Set();
  for (const r of data) {
    const q = parseQuarter(r.Quarter);
    if (!q) throw new Error(`Data_Ret_D01: can't read quarter "${r.Quarter}"`);
    const group = String(r['Return type group']).trim().replace(/\s+/g, ' ').toLowerCase();
    const key = known.get(group);
    if (!key) throw new Error(`Data_Ret_D01: unknown return type group "${r['Return type group']}"`);
    seen.add(key);
    const qi = qIndex(q.year, q.q);
    if (!totals.has(qi)) totals.set(qi, { enforced: 0, voluntary: 0, refusedAtPort: 0 });
    totals.get(qi)[key] += num(r['Number of returns']) ?? 0; // no suppression in this dataset
  }
  for (const k of Object.keys(RETURN_GROUPS)) if (!seen.has(k)) throw new Error(`Data_Ret_D01: no "${RETURN_GROUPS[k]}" rows`);
  const quarterSet = new Set(totals.keys());
  const yearList = completeYearsEndingJune(quarterSet);
  if (!yearList.length) throw new Error('Data_Ret_D01: no complete year ending June');
  const firstProvisional = Math.max(...quarterSet) - (PROVISIONAL_QUARTERS - 1);
  const series = (k) => yearList.map((y) => yeJuneQuarters(y).reduce((s, qi) => s + totals.get(qi)[k], 0));
  return {
    years: yearList.map((y) => ({ year: y, label: yeLabel(y), provisional: yeJuneQuarters(y).some((qi) => qi >= firstProvisional) })),
    enforced: series('enforced'),
    voluntary: series('voluntary'),
    refusedAtPort: series('refusedAtPort'),
  };
}

// ---------------------------------------------------------------- Ret_06a: small boat returns

const QUARTER_MONTHS = ['January to March', 'April to June', 'July to September', 'October to December'];

/** Ret_06a rows → quarterly returns of small boat arrivals; "[p]" marks a provisional quarter. */
export function buildSmallBoatReturns(rows) {
  const data = table(rows, 'Date of return', ['Date of return', 'Returns'], 'Ret_06a');
  const quarters = [];
  const returns = [];
  for (const r of data) {
    const raw = String(r['Date of return'] ?? '').trim();
    const q = parseQuarter(raw);
    if (!q || !/^\d{4} Q\d\b/.test(raw)) continue; // "YYYY Total" and "2026 (Jan - Jun)" rows
    quarters.push({ key: `${q.year} Q${q.q}`, label: `${QUARTER_MONTHS[q.q - 1]} ${q.year}`, provisional: /\[p\]/i.test(raw) });
    returns.push(num(r.Returns));
  }
  if (!quarters.length) throw new Error('Ret_06a: no "YYYY Qn" rows');
  const last4 = returns.slice(-4);
  return { quarters, returns, latestYear: last4.length === 4 && last4.every((v) => v !== null) ? last4.reduce((s, v) => s + v, 0) : null };
}

// ---------------------------------------------------------------- the page

/** All the tables (as rows of cells) → the page's data, in the contract's order. */
export function buildSmallBoats({ ier02a, ier02d, ierD01, retD01, ret06a }) {
  const { months, perBoat } = buildMonths(ier02a);
  const a = buildArrivals(ierD01);
  return {
    updated: a.years.at(-1).label,
    months,
    perBoat,
    years: a.years,
    arrivals: a.arrivals,
    detections: a.detections,
    nationalities: a.nationalities,
    notRecorded: a.notRecorded,
    ageSex: a.ageSex,
    claimed: buildClaimed(ier02d),
    returns: buildReturns(retD01),
    smallBoatReturns: buildSmallBoatReturns(ret06a),
  };
}

// ---------------------------------------------------------------- files

const EDITION_MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const editionOrder = (m) => Number(m[2]) * 12 + EDITION_MONTHS.indexOf(m[1].slice(0, 3).toLowerCase());

/** The latest edition's file in a folder matching `pattern` (names carry "jun-2026" etc.). */
async function latestFile(dir, pattern, what) {
  const names = existsSync(dir) ? await readdir(dir) : [];
  const hits = names.map((n) => [n, pattern.exec(n)]).filter(([, m]) => m);
  if (!hits.length) throw new Error(`${what}: no file matching ${pattern} in ${dir}. Run without --cached to download it.`);
  hits.sort((x, y) => editionOrder(y[1]) - editionOrder(x[1]));
  return join(dir, hits[0][0]);
}

async function downloadAll() {
  const html = await fetchText(PAGE);
  for (const { source, pattern } of Object.values(FILES)) {
    const url = findLink(html, PAGE, pattern);
    const name = decodeURIComponent(new URL(url).pathname.split('/').pop());
    const dest = join(inputDir(source, 'download'), name);
    if (!existsSync(dest)) await download(url, dest); // file names carry the edition
  }
}

const readCsv = async (dir, sheet) => parse(await readFile(join(dir, `${sheet}.csv`), 'utf8'), { relax_column_count: true, skip_empty_lines: false });

async function readTables(mode) {
  if (mode === 'fixture') {
    const irr = inputDir('ho-irregular', mode);
    const ret = inputDir('ho-returns', mode);
    return {
      ier02a: await readCsv(irr, 'IER_02a'),
      ier02d: await readCsv(irr, 'IER_02d'),
      ierD01: await readCsv(irr, 'Data_IER_D01'),
      retD01: await readCsv(ret, 'Data_Ret_D01'),
      ret06a: await readCsv(ret, 'Ret_06a'),
    };
  }
  const path = (k) => latestFile(inputDir(FILES[k].source, mode), FILES[k].pattern, FILES[k].source);
  const irrSummary = await readOds(await path('irregularSummary'));
  const irrData = await readXlsx(await path('irregularData'));
  const retSummary = await readOds(await path('returnsSummary'));
  const retData = await readXlsx(await path('returnsData'));
  return {
    ier02a: irrSummary.sheet('IER_02a'),
    ier02d: irrSummary.sheet('IER_02d'),
    ierD01: await irrData.sheet('Data_IER_D01'),
    retD01: await retData.sheet('Data_Ret_D01'),
    ret06a: retSummary.sheet('Ret_06a'),
  };
}

export async function run(mode) {
  if (mode === 'download') await downloadAll();
  const data = buildSmallBoats(await readTables(mode));
  await writeJson(`features/${NAME}.json`, data);
  const latest = data.arrivals.at(-1);
  return `${data.updated}: ${latest} small boat arrivals, ${data.returns.enforced.at(-1)} enforced returns (${mode})`;
}
