// Where support is housed: people on asylum support per 10,000 residents in every UK local
// authority district, set against disposable income per head, for a section of the
// asylum-support tool page. Builds public/data/features/asylum-income.json.
//
// The question, fairly: do people on asylum support live disproportionately in lower-income
// areas? This is correlation only. The Home Office's contractors choose and procure the housing;
// the data shows where people are accommodated, not any council's willingness.
//
// Publishers and tables (all Open Government Licence v3.0):
// - Home Office, Immigration system statistics data tables: Data_Asy_D11 in
//   support-local-authority-datasets-<mon>-<yyyy>.xlsx (people on asylum support by local
//   authority, at each quarter end). Quarterly. Read and banded with asylum-support.js.
// - ONS, Population estimates for the UK…: MYE4 in mye<yy>tablesuk.xlsx (persons, all ages, at
//   30 June). Annual (October).
// - ONS, Regional gross disposable household income: local authorities: Table 3 in
//   regionalgrossdisposablehouseholdincomelocalauthorities<yyyy>.xlsx (GDHI per head, £, current
//   prices). Annual (late summer). Official statistics in development. ONS's Comments sheet: "The
//   latest year's data are provisional", so the latest year is always labelled provisional.
// - HM Land Registry with ONS, Registers of Scotland and LPS Northern Ireland, UK House Price
//   Index: Average-prices-<yyyy>-<mm>.csv from the monthly "UK House Price Index: data downloads"
//   page (average price, £, not seasonally adjusted; the latest month only). Monthly. Attribution:
//   "Contains HM Land Registry data © Crown copyright and database right 2020. This data is
//   licensed under the Open Government Licence v3.0." Context for the page: the cost of housing
//   drives where accommodation is bought (Home Affairs Committee, HC 580, October 2025).
//   Northern Ireland's figures are quarterly, repeated in each month of the quarter.
//
// Banding: every per-area count is the asylum-support Count ({ n rounded to 5 at 10+, null with
// band "fewer than 10" for 1 to 9, 0 for none }). Rates are built from the ROUNDED n, and are
// null when the count is banded. Quintile totals sum the EXACT counts (a sum over about 72
// districts can't reveal a small cell). Districts with no D11 row at all count as 0 (none listed).

import { readdir, readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { parse } from 'csv-parse/sync';
import { download, fetchText, findLinks } from '../lib/fetch.js';
import { readWorkbook } from '../lib/xlsx.js';
import { expectColumns, inputDir, num, rowsUnder, writeJson } from '../lib/util.js';
import { band, buildAsylumSupport, readD11 } from './asylum-support.js';

const PAGE = 'asylum-income';

const SUPPORT = {
  id: 'ho-asylum',
  sheet: 'Data_Asy_D11',
  file: /support-local-authority-datasets-[a-z]+-\d{4}\.xlsx$/i,
  fixture: 'support-Data_Asy_D11.csv',
  page: 'https://www.gov.uk/government/statistical-data-sets/immigration-system-statistics-data-tables',
};
const POPULATION = {
  id: 'ons-population',
  sheet: 'MYE4',
  file: /mye\d\dtablesuk\.xlsx$/i,
  fixture: 'MYE4.csv',
  page: 'https://www.ons.gov.uk/peoplepopulationandcommunity/populationandmigration/populationestimates/datasets/populationestimatesforukenglandandwalesscotlandandnorthernireland',
};
const INCOME = {
  id: 'ons-gdhi',
  sheet: 'Table 3',
  file: /regionalgrossdisposablehouseholdincomelocalauthorities\d{4}\.xlsx$/i,
  fixture: 'Table 3.csv',
  page: 'https://www.ons.gov.uk/economy/regionalaccounts/grossdisposablehouseholdincome/datasets/regionalgrossdisposablehouseholdincomelocalauthorities',
};
const HOUSE_PRICES = {
  id: 'lr-hpi',
  file: /^Average-prices-\d{4}-\d{2}\.csv$/,
  collection: 'https://www.gov.uk/government/collections/uk-house-price-index-reports',
  downloads: /\/government\/statistical-data-sets\/uk-house-price-index-data-downloads-/,
};
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** The six MYE4 Geography values that are districts (the rest are countries, regions, counties). */
export const DISTRICT_TYPES = ['Unitary Authority', 'Metropolitan District', 'Non-metropolitan District', 'London Borough', 'Council Area', 'Local Government District'];

/**
 * Home Office (and UK HPI) codes → ONS codes. D11 and the UK HPI use the April 2025 codes issued for a minor
 * Barnsley–Sheffield boundary adjustment; the ONS tables use the earlier ones. One-to-one.
 */
export const CODE_MAP = { E08000038: 'E08000016', E08000039: 'E08000019' };

/** Districts below this population are kept in the table but left out of rankings and the correlation. */
export const MIN_POPULATION = 25000;

const round1 = (x) => Math.round(x * 10) / 10;
const round2 = (x) => Math.round(x * 100) / 100;

/** MYE4 rows (arrays of cells) → { period: 'mid-2025', byCode: Map(code → { name, population }) }, districts only. */
export function readPopulation(rows) {
  const records = rowsUnder(rows, 'Code', `${PAGE} MYE4`);
  if (records.length === 0) throw new Error(`${PAGE}: MYE4 has no rows`);
  const years = Object.keys(records[0]).filter((k) => /^Mid-\d{4}$/.test(k));
  if (years.length === 0) throw new Error(`${PAGE}: MYE4 has no "Mid-YYYY" columns`);
  const latest = years.sort().at(-1);
  expectColumns(records[0], ['Code', 'Name', 'Geography', latest], `${PAGE} MYE4`);
  const byCode = new Map();
  for (const r of records) {
    if (!DISTRICT_TYPES.includes(String(r.Geography ?? '').trim())) continue;
    const code = String(r.Code).trim();
    const population = num(r[latest]);
    if (population === null) throw new Error(`${PAGE}: MYE4 has no ${latest} population for ${code}`);
    if (byCode.has(code)) throw new Error(`${PAGE}: MYE4 lists ${code} twice`);
    byCode.set(code, { name: String(r.Name).trim(), population });
  }
  if (byCode.size === 0) throw new Error(`${PAGE}: MYE4 has no district rows (Geography values changed?)`);
  return { period: latest.toLowerCase(), byCode };
}

/** GDHI Table 3 rows → { year: '2024', byCode: Map(code → { region, name, incomePerHead }) }. */
export function readIncome(rows) {
  const records = rowsUnder(rows, 'Region', `${PAGE} GDHI Table 3`);
  if (records.length === 0) throw new Error(`${PAGE}: GDHI Table 3 has no rows`);
  const years = Object.keys(records[0]).filter((k) => /^\d{4}$/.test(k));
  if (years.length === 0) throw new Error(`${PAGE}: GDHI Table 3 has no year columns`);
  const year = years.sort().at(-1);
  expectColumns(records[0], ['Region', 'LAD code', 'LAD name', year], `${PAGE} GDHI Table 3`);
  const byCode = new Map();
  for (const r of records) {
    const code = String(r['LAD code'] ?? '').trim();
    const income = num(r[year]);
    if (income === null) throw new Error(`${PAGE}: GDHI Table 3 has no ${year} figure for ${code}`);
    if (byCode.has(code)) throw new Error(`${PAGE}: GDHI Table 3 lists ${code} twice`);
    byCode.set(code, { region: String(r.Region).trim(), name: String(r['LAD name']).trim(), incomePerHead: Math.round(income) });
  }
  return { year, byCode };
}

/**
 * UK HPI Average-prices rows (arrays of cells) → { month: 'August 2026', byCode: Map(ONS code → £) }
 * for the latest month in the file. Re-codes Barnsley and Sheffield. Regions and countries stay in
 * the map but are never looked up. Districts with no row (the Isles of Scilly) get null later.
 */
export function readHousePrices(rows) {
  const what = `${PAGE} UK HPI Average prices`;
  const records = rowsUnder(rows, 'Date', what);
  if (records.length === 0) throw new Error(`${what} has no rows`);
  expectColumns(records[0], ['Date', 'Region_Name', 'Area_Code', 'Average_Price'], what);
  const latest = records.reduce((m, r) => (String(r.Date) > m ? String(r.Date) : m), '');
  if (!/^\d{4}-\d{2}-01$/.test(latest)) throw new Error(`${what}: unexpected date "${latest}"`);
  const byCode = new Map();
  for (const r of records) {
    if (String(r.Date) !== latest) continue;
    const raw = String(r.Area_Code ?? '').trim();
    const price = num(r.Average_Price);
    if (price !== null) byCode.set(CODE_MAP[raw] ?? raw, Math.round(price)); // a blank price is treated as no row
  }
  return { month: `${MONTH_NAMES[Number(latest.slice(5, 7)) - 1]} ${latest.slice(0, 4)}`, byCode };
}

/**
 * D11 records (from readD11) → { updated, exact: Map(ONS code → exact people at the latest date) }.
 * Runs buildAsylumSupport too, so its validation applies and its banded totals are checked
 * against ours. Re-codes Barnsley and Sheffield.
 */
export function supportByCode(records) {
  const { index } = buildAsylumSupport(records);
  const latest = records.reduce((m, r) => (r.date > m ? r.date : m), '');
  const exact = new Map();
  for (const r of records) {
    if (r.date !== latest || !r.code) continue;
    const code = CODE_MAP[r.code] ?? r.code;
    exact.set(code, (exact.get(code) ?? 0) + r.people);
  }
  for (const a of index.areas) {
    const ours = band(exact.get(CODE_MAP[a.code] ?? a.code) ?? 0);
    if (ours.n !== a.total.n || ours.band !== a.total.band) throw new Error(`${PAGE}: ${a.code} totals disagree with asylum-support`);
  }
  return { updated: index.updated, exact };
}

/** Spearman rank correlation (average ranks for ties). */
export function spearman(xs, ys) {
  const rank = (v) => {
    const order = v.map((x, i) => [x, i]).sort((a, b) => a[0] - b[0]);
    const r = new Array(v.length);
    for (let i = 0; i < order.length; ) {
      let j = i;
      while (j + 1 < order.length && order[j + 1][0] === order[i][0]) j++;
      for (let k = i; k <= j; k++) r[order[k][1]] = (i + j) / 2 + 1;
      i = j + 1;
    }
    return r;
  };
  const a = rank(xs);
  const b = rank(ys);
  const mean = (v) => v.reduce((s, x) => s + x, 0) / v.length;
  const ma = mean(a);
  const mb = mean(b);
  let num_ = 0;
  let da = 0;
  let db = 0;
  for (let i = 0; i < a.length; i++) {
    num_ += (a[i] - ma) * (b[i] - mb);
    da += (a[i] - ma) ** 2;
    db += (b[i] - mb) ** 2;
  }
  return da && db ? num_ / Math.sqrt(da * db) : null;
}

/** Splits areas into fifths (1 = lowest) by `key` (income per head unless given), then code: rank i → floor(i × 5 / N) + 1. */
export function quintileOf(areas, key = 'incomePerHead') {
  const sorted = [...areas].sort((a, b) => a[key] - b[key] || a.code.localeCompare(b.code));
  return new Map(sorted.map((a, i) => [a.code, Math.floor((i * 5) / sorted.length) + 1]));
}

const isFewOrNone = (a) => a.supported.n === null || a.supported.n === 0;

/**
 * The five quintile rows for `areas` (each with `exact`), re-cutting the fifths on exactly these
 * areas by `key`. The bounds are named for the key: incomeFrom/incomeTo, or priceFrom/priceTo.
 */
export function quintileRows(areas, key = 'incomePerHead') {
  const q = quintileOf(areas, key);
  const [from, to] = key === 'housePrice' ? ['priceFrom', 'priceTo'] : ['incomeFrom', 'incomeTo'];
  return [1, 2, 3, 4, 5].map((quintile) => {
    const group = areas.filter((a) => q.get(a.code) === quintile);
    const values = group.map((a) => a[key]);
    const population = group.reduce((s, a) => s + a.population, 0);
    const supported = group.reduce((s, a) => s + a.exact, 0); // exact, unrounded counts
    return {
      quintile,
      [from]: group.length ? Math.min(...values) : null,
      [to]: group.length ? Math.max(...values) : null,
      areas: group.length,
      population,
      supported,
      ratePer10k: population ? round1((supported / population) * 10000) : null,
      fewerThan10OrNone: group.filter(isFewOrNone).length,
    };
  });
}

/**
 * The page's data, from the four readers' outputs. Every district in the population table is
 * an area; GDHI must have exactly the same codes, and every (re-coded) D11 code must be among them.
 * House prices may be missing for a district (null): it's then left out of the house-price
 * fifths and that correlation only.
 */
export function buildAsylumIncome(population, income, support, housePrices) {
  const codes = [...population.byCode.keys()];
  const missingIncome = codes.filter((c) => !income.byCode.has(c));
  const extraIncome = [...income.byCode.keys()].filter((c) => !population.byCode.has(c));
  if (missingIncome.length || extraIncome.length)
    throw new Error(`${PAGE}: population and GDHI district codes differ (no GDHI: ${missingIncome.join(', ') || 'none'}; no population: ${extraIncome.join(', ') || 'none'})`);
  const unmatched = [...support.exact.keys()].filter((c) => !population.byCode.has(c));
  if (unmatched.length) throw new Error(`${PAGE}: asylum support codes with no ONS district: ${unmatched.join(', ')}. Add them to CODE_MAP if they are re-codes.`);

  // `exact` is the unrounded count, used for quintile sums only, and dropped before writing.
  const full = codes.map((code) => {
    const { name, population: pop } = population.byCode.get(code);
    const { region, incomePerHead } = income.byCode.get(code);
    const exact = support.exact.get(code) ?? 0; // no D11 row = none listed
    const supported = band(exact);
    const ratePer10k = supported.n === null ? null : round1((supported.n / pop) * 10000); // from the ROUNDED n
    const housePrice = housePrices.byCode.get(code) ?? null; // no UK HPI figure: null, never 0
    return { code, name, region, population: pop, incomePerHead, housePrice, supported, ratePer10k, exact };
  });
  const q = quintileOf(full);
  for (const a of full) a.quintile = q.get(a.code);
  full.sort((a, b) => a.name.localeCompare(b.name, 'en-GB') || a.code.localeCompare(b.code));

  const ranked = full.filter((a) => a.population >= MIN_POPULATION && a.ratePer10k !== null);
  const row = (a) => ({ code: a.code, name: a.name, region: a.region, ratePer10k: a.ratePer10k, supported: a.supported, incomePerHead: a.incomePerHead, quintile: a.quintile });
  const highest = [...ranked].sort((a, b) => b.ratePer10k - a.ratePer10k || a.name.localeCompare(b.name, 'en-GB')).slice(0, 10).map(row);
  const lowest = ranked
    .filter((a) => a.supported.n >= 10)
    .sort((a, b) => a.ratePer10k - b.ratePer10k || a.name.localeCompare(b.name, 'en-GB'))
    .slice(0, 10)
    .map(row);
  const r = spearman(ranked.map((a) => a.incomePerHead), ranked.map((a) => a.ratePer10k));
  const priced = ranked.filter((a) => a.housePrice !== null);
  const rHouse = spearman(priced.map((a) => a.housePrice), priced.map((a) => a.ratePer10k));
  const few = full.filter(isFewOrNone);

  return {
    updated: { support: support.updated, population: population.period, income: `${income.year} (provisional)`, housePrice: housePrices.month },
    areas: full.map(({ exact, ...a }) => a),
    quintiles: quintileRows(full),
    quintilesOutsideLondon: quintileRows(full.filter((a) => !a.code.startsWith('E09'))),
    quintilesByHousePrice: quintileRows(full.filter((a) => a.housePrice !== null), 'housePrice'),
    correlation: r === null ? null : round2(r),
    correlationHousePrice: rHouse === null ? null : round2(rHouse),
    highest,
    lowest,
    noneOrFew: { count: few.length, inTopQuintile: few.filter((a) => a.quintile === 5).length, inBottomQuintile: few.filter((a) => a.quintile === 1).length },
  };
}

/** The newest file in `dir` matching `pattern`. */
async function newest(dir, pattern) {
  const files = (await readdir(dir).catch(() => [])).filter((f) => pattern.test(f));
  if (files.length === 0) throw new Error(`${PAGE}: no file matching ${pattern} in ${dir}. Run without --cached to download it.`);
  const dated = await Promise.all(files.map(async (f) => ({ f, t: (await stat(join(dir, f))).mtimeMs })));
  return join(dir, dated.sort((a, b) => b.t - a.t)[0].f);
}

/** One sheet as rows of cells: the workbook in real modes, `<sheet>.csv` in fixture mode. */
async function sheetRows(src, mode) {
  const dir = inputDir(src.id, mode);
  if (mode === 'fixture') return parse(await readFile(join(dir, src.fixture), 'utf8'), { relax_column_count: true, skip_empty_lines: true });
  const wb = await readWorkbook(await newest(dir, src.file));
  if (!wb.names.includes(src.sheet)) throw new Error(`${PAGE}: no sheet ${src.sheet} in the ${src.id} workbook (has ${wb.names.join(', ')})`);
  return wb.sheet(src.sheet);
}

/** The newest Average-prices CSV in the lr-hpi folder (real and fixture modes alike: it's a CSV either way). */
async function housePriceRows(mode) {
  const file = await newest(inputDir(HOUSE_PRICES.id, mode), HOUSE_PRICES.file);
  return parse(await readFile(file, 'utf8'), { relax_column_count: true, skip_empty_lines: true });
}

/** The UK HPI CSV: the collection page links this month's "data downloads" page (its slug changes monthly), which links the file. */
async function fetchHousePrices() {
  const collection = await fetchText(HOUSE_PRICES.collection);
  const page = findLinks(collection, HOUSE_PRICES.collection, /./).find((u) => HOUSE_PRICES.downloads.test(new URL(u).pathname));
  if (!page) throw new Error(`${PAGE}: no "UK House Price Index: data downloads" link on ${HOUSE_PRICES.collection}`);
  const fileOf = (u) => new URL(u).pathname.split('/').pop();
  const url = findLinks(await fetchText(page), page, /./).find((u) => HOUSE_PRICES.file.test(fileOf(u)));
  if (!url) throw new Error(`${PAGE}: no Average-prices-YYYY-MM.csv link on ${page}`);
  await download(url, join(inputDir(HOUSE_PRICES.id, 'cached'), fileOf(url)));
}

/** Downloads the first link on the publisher's page whose file name matches (ONS pages list the current edition first). */
async function fetchFirst(src) {
  const html = await fetchText(src.page);
  const fileOf = (u) => {
    const url = new URL(u);
    return decodeURIComponent(url.searchParams.get('uri') ?? url.pathname).split('/').pop();
  };
  const url = findLinks(html, src.page, /./).find((u) => src.file.test(fileOf(u)));
  if (!url) throw new Error(`${PAGE}: no link matching ${src.file} on ${src.page}`);
  await download(url, join(inputDir(src.id, 'cached'), fileOf(url)));
}

export async function run(mode) {
  if (mode === 'download') {
    for (const src of [SUPPORT, POPULATION, INCOME]) await fetchFirst(src);
    await fetchHousePrices();
  }
  const data = buildAsylumIncome(
    readPopulation(await sheetRows(POPULATION, mode)),
    readIncome(await sheetRows(INCOME, mode)),
    supportByCode(readD11(await sheetRows(SUPPORT, mode))),
    readHousePrices(await housePriceRows(mode)),
  );
  await writeJson(`features/${PAGE}.json`, data);
  const noPrice = data.areas.filter((a) => a.housePrice === null).length;
  return `${data.areas.length} districts (${noPrice} without a house price), rank correlation ${data.correlation} with income, ${data.correlationHousePrice} with house prices, support at ${data.updated.support} (${mode})`;
}
