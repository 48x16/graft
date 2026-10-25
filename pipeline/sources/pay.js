// Pay Packet: builds public/data/features/pay.json for pay.html.
//
// Publisher: Office for National Statistics (ONS), two datasets in .cache/ons-pay/:
// - ASHE Table 3 (region by occupation, two-digit SOC 2020), one zip per edition
//   (ashetable3<yyyy>provisional.zip / …revised.zip). Read: Table 3.1a (weekly pay, gross),
//   3.5a (hourly pay, gross) and 3.7a (annual pay, gross), sheet "Full-Time", Median and its
//   annual percentage change. UK employee jobs, April. Annual; provisional each October.
// - Earnings and employment from PAYE Real Time Information, seasonally adjusted
//   (rtisa<mon><yyyy>.xlsx). Read: sheets 1 (payrolled employees), 2 (median pay, UK),
//   8 (median pay, NUTS1) and 24 (median pay, industry). Monthly; the latest month is a flash
//   estimate. Accredited official statistics.
// Licence: Open Government Licence v3.0.
//
// ASHE marks unreliable estimates "x": they become null here (never 0). RTI has no markers.

import { createWriteStream } from 'node:fs';
import { mkdir, readdir, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { parse } from 'csv-parse/sync';
import { download, fetchText, findLinks } from '../lib/fetch.js';
import { readWorkbook } from '../lib/xlsx.js';
import { listEntries, openEntry } from '../lib/zip.js';
import { clean, inputDir, num, writeJson } from '../lib/util.js';

const NAME = 'pay';
const SOURCE = 'ons-pay';
const ASHE_PAGE = 'https://www.ons.gov.uk/employmentandlabourmarket/peopleinwork/earningsandworkinghours/datasets/regionbyoccupation2digitsocashetable3';
const RTI_PAGE = 'https://www.ons.gov.uk/employmentandlabourmarket/peopleinwork/earningsandworkinghours/datasets/realtimeinformationstatisticsreferencetableseasonallyadjusted';

const ASHE_TABLES = { weekly: '3.1a', hourly: '3.5a', annual: '3.7a' };
const ASHE_SHEET = 'Full-Time';
const UK = 'K02000001';
/** The 12 regions and nations, in ONS order (GSS codes). */
export const ASHE_REGIONS = ['E12000001', 'E12000002', 'E12000003', 'E12000004', 'E12000005', 'E12000006', 'E12000007', 'E12000008', 'E12000009', 'W92000004', 'S92000003', 'N92000002'];
export const RTI_REGIONS = ['UKC', 'UKD', 'UKE', 'UKF', 'UKG', 'UKH', 'UKI', 'UKJ', 'UKK', 'UKL', 'UKM', 'UKN'];
export const RTI_INDUSTRIES = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T-U'];
const RTI_SHEETS = {
  payrolled: '1. Payrolled employees (UK)',
  median: '2. Median pay (UK)',
  regions: '8. Median pay (NUTS1)',
  industries: '24. Median pay (Industry)',
};
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** "'E12000005 " → "E12000005". */
const code = (cell) => String(cell ?? '').trim().replace(/^'/, '').trim();
/** A percentage cell (5.8, or 8.199999999999999) → a fraction to 3 dp (0.058); "x" → null. */
const pctFraction = (cell) => {
  const n = num(cell);
  return n === null ? null : Math.round(n * 10) / 1000;
};

/**
 * One ASHE Table 3 sheet (rows of cells, as read) → { year, uk: { median, change },
 * regions: Map(code → { name, median, change }), occupations: Map(code → { name, median }) }.
 * Occupations are the UK block's two-digit SOC codes. Throws if the layout has changed.
 */
export function readAsheSheet(rows, what) {
  const title = String(rows[0]?.[0] ?? '');
  const year = Number(/(\d{4})\s*$/.exec(title.trim())?.[1]);
  if (!year) throw new Error(`${what}: no year at the end of the title "${title}"`);
  const h = rows.findIndex((r) => clean(r[0]) === 'Description' && clean(r[1]) === 'Code');
  if (h === -1) throw new Error(`${what}: no header row "Description | Code". Has the table changed?`);
  const header = rows[h].map(clean);
  const iMedian = header.indexOf('Median');
  if (iMedian === -1 || header[iMedian + 1] !== 'change') throw new Error(`${what}: expected "Median" then "change" columns, got ${header.join(' | ')}`);

  let uk = null;
  const regions = new Map();
  const occupations = new Map();
  let geo = null;
  for (const r of rows.slice(h + 1)) {
    const c = code(r[1]);
    if (/^[A-Z]\d{8}$/.test(c)) {
      geo = c;
      const entry = { name: clean(r[0]), median: num(r[iMedian]), change: pctFraction(r[iMedian + 1]) };
      if (c === UK) uk = entry;
      else regions.set(c, entry);
    } else if (geo === UK && /^\d{2}$/.test(c)) {
      occupations.set(c, { name: clean(r[0]), median: num(r[iMedian]) });
    }
  }
  if (!uk) throw new Error(`${what}: no United Kingdom row (${UK})`);
  const missing = ASHE_REGIONS.filter((c) => !regions.has(c));
  if (missing.length) throw new Error(`${what}: missing region rows ${missing.join(', ')}`);
  const extra = [...regions.keys()].filter((c) => !ASHE_REGIONS.includes(c));
  if (extra.length) throw new Error(`${what}: unexpected geography codes ${extra.join(', ')}`);
  if (occupations.size !== 26) throw new Error(`${what}: expected 26 two-digit SOC 2020 groups under the UK, found ${occupations.size}`);
  return { year, uk, regions, occupations };
}

/** The ASHE part of the contract, from the three Full-Time sheets' rows. */
export function buildAshe({ weekly, hourly, annual }, provisional) {
  const w = readAsheSheet(weekly, 'ASHE 3.1a');
  const h = readAsheSheet(hourly, 'ASHE 3.5a');
  const a = readAsheSheet(annual, 'ASHE 3.7a');
  if (h.year !== w.year || a.year !== w.year) throw new Error(`ASHE: tables are for different years (${w.year}, ${h.year}, ${a.year})`);
  if (w.uk.median === null || a.uk.median === null) throw new Error('ASHE: the UK full-time median is missing');
  const byMedian = (x, y) => (x.weekly === null) - (y.weekly === null) || (y.weekly ?? 0) - (x.weekly ?? 0);
  return {
    year: w.year,
    provisional,
    ukFullTimeWeekly: w.uk.median,
    ukFullTimeWeeklyChange: w.uk.change,
    ukFullTimeAnnual: a.uk.median,
    regions: ASHE_REGIONS.map((c) => {
      const r = w.regions.get(c);
      return { code: c, name: r.name, weekly: r.median, weeklyChange: r.change, hourly: h.regions.get(c).median };
    }).sort(byMedian),
    occupations: [...w.occupations].map(([c, o]) => ({ code: c, name: o.name, major: c[0], weekly: o.median, hourly: h.occupations.get(c)?.median ?? null })).sort(byMedian),
  };
}

/** "September 2026" → "2026-09", or null if the cell isn't a month. */
export function monthKey(label) {
  const m = /^([A-Z][a-z]+) (\d{4})$/.exec(String(label ?? '').trim());
  const i = m ? MONTHS.indexOf(m[1]) : -1;
  return i === -1 ? null : `${m[2]}-${String(i + 1).padStart(2, '0')}`;
}

/** Rows of an RTI sheet from its "Date" header down: [{ key, label, cells }], oldest first. */
function rtiRows(rows, what) {
  const h = rows.findIndex((r) => clean(r[0]) === 'Date');
  if (h === -1) throw new Error(`RTI ${what}: no header row starting "Date". Has the table changed?`);
  const data = rows
    .slice(h + 1)
    .map((r) => ({ key: monthKey(r[0]), label: String(r[0]).trim(), cells: r }))
    .filter((r) => r.key);
  if (data.length === 0) throw new Error(`RTI ${what}: no monthly rows`);
  data.forEach((r, i) => {
    if (i && r.key <= data[i - 1].key) throw new Error(`RTI ${what}: months out of order at ${r.label}`);
  });
  return { header: rows[h].map(clean), codes: (rows[h - 1] ?? []).map(code), data };
}

/** Latest row of a sheet with codes in the row above "Date" → [{ code, name, medianMonthly }], largest first. */
function latestByCode(rows, expected, what) {
  const { header, codes, data } = rtiRows(rows, what);
  const missing = expected.filter((c) => !codes.includes(c));
  if (missing.length) throw new Error(`RTI ${what}: missing codes ${missing.join(', ')}`);
  const last = data[data.length - 1];
  return {
    label: last.label,
    items: expected
      .map((c) => {
        const i = codes.indexOf(c);
        return { code: c, name: header[i], medianMonthly: num(last.cells[i]) };
      })
      .sort((x, y) => (x.medianMonthly === null) - (y.medianMonthly === null) || (y.medianMonthly ?? 0) - (x.medianMonthly ?? 0)),
  };
}

/** The RTI part of the contract, from the four sheets' rows. */
export function buildRti({ payrolled, median, regions, industries }) {
  const p = rtiRows(payrolled, RTI_SHEETS.payrolled);
  const m = rtiRows(median, RTI_SHEETS.median);
  if (p.header[1] !== 'Payrolled employees') throw new Error(`RTI sheet 1: expected "Payrolled employees", got "${p.header[1]}"`);
  if (m.header[1] !== 'Median pay') throw new Error(`RTI sheet 2: expected "Median pay", got "${m.header[1]}"`);
  if (p.data.map((r) => r.key).join() !== m.data.map((r) => r.key).join()) throw new Error('RTI: sheets 1 and 2 cover different months');
  const reg = latestByCode(regions, RTI_REGIONS, RTI_SHEETS.regions);
  const ind = latestByCode(industries, RTI_INDUSTRIES, RTI_SHEETS.industries);
  const flashLabel = p.data[p.data.length - 1].label;
  if (reg.label !== flashLabel || ind.label !== flashLabel) throw new Error(`RTI: latest months differ (${flashLabel}, ${reg.label}, ${ind.label})`);
  return {
    months: p.data.map((r) => ({ key: r.key, label: r.label })),
    payrolled: p.data.map((r) => num(r.cells[1])),
    medianMonthly: m.data.map((r) => num(r.cells[1])),
    flashLabel,
    regions: reg.items,
    industries: ind.items,
  };
}

/** The whole page. */
export function buildPay(ashe, rti) {
  const status = ashe.provisional ? 'ASHE, provisional' : 'ASHE, revised';
  return { updated: `April ${ashe.year} (${status}); ${rti.flashLabel} (PAYE)`, ashe, rti };
}

// ---- Files ---------------------------------------------------------------------------------

const ASHE_ZIP = /ashetable3(\d{4})(provisional|revised)\.zip$/i;
const RTI_FILE = /rtisa([a-z]{3})(\d{4})\.xlsx$/i;
const SHORT = MONTHS.map((m) => m.slice(0, 3).toLowerCase());
const tableRe = (t) => new RegExp(`Table ${t.replace('.', '\\.')}\\s`);

/** The newest of several file names, by a sortable key; null if none match. */
const newest = (names, re, key) =>
  names
    .filter((n) => re.test(n))
    .sort((a, b) => key(b.match(re)).localeCompare(key(a.match(re))))[0] ?? null;
const asheKey = (m) => `${m[1]}${m[2].toLowerCase() === 'revised' ? 1 : 0}`;
const rtiKey = (m) => `${m[2]}${String(SHORT.indexOf(m[1].toLowerCase())).padStart(2, '0')}`;

async function fetchCurrent(dir) {
  await mkdir(dir, { recursive: true });
  const asheUrl = findLinks(await fetchText(ASHE_PAGE), ASHE_PAGE, ASHE_ZIP)[0];
  if (!asheUrl) throw new Error(`No ashetable3 zip linked on ${ASHE_PAGE}`);
  const rtiUrl = findLinks(await fetchText(RTI_PAGE), RTI_PAGE, RTI_FILE)[0];
  if (!rtiUrl) throw new Error(`No rtisa*.xlsx linked on ${RTI_PAGE}`);
  const zipName = decodeURIComponent(new URL(asheUrl).pathname).split('/').pop();
  const rtiName = decodeURIComponent(new URL(rtiUrl).pathname).split('/').pop();
  // Drop older editions so the newest is unambiguous, and re-extract the ASHE tables.
  for (const f of await readdir(dir)) {
    if ((ASHE_ZIP.test(f) && f !== zipName) || (RTI_FILE.test(f) && f !== rtiName)) await rm(join(dir, f));
  }
  await rm(join(dir, 'ashe3'), { recursive: true, force: true });
  await download(asheUrl, join(dir, zipName));
  await download(rtiUrl, join(dir, rtiName));
}

/** The three ASHE workbooks' paths in .cache/ons-pay/ashe3/, extracting them from the zip if needed. */
export async function asheWorkbooks(dir) {
  const zip = newest(await readdir(dir), ASHE_ZIP, asheKey);
  if (!zip) throw new Error(`${dir}: no ashetable3<yyyy>(provisional|revised).zip. Run without --cached to download it.`);
  const year = zip.match(ASHE_ZIP)[1];
  const out = join(dir, 'ashe3');
  await mkdir(out, { recursive: true });
  const have = await readdir(out);
  const entries = await listEntries(join(dir, zip));
  const paths = {};
  for (const [key, t] of Object.entries(ASHE_TABLES)) {
    const want = (n) => tableRe(t).test(n) && n.endsWith(`${year}.xlsx`);
    let name = have.find(want);
    if (!name) {
      const entry = entries.find((e) => want(e.name.split('/').pop()));
      if (!entry) throw new Error(`${zip}: no Table ${t} workbook for ${year}`);
      name = entry.name.split('/').pop();
      await pipeline(await openEntry(join(dir, zip), entry), createWriteStream(join(out, name)));
    }
    paths[key] = join(out, name);
  }
  return { paths, provisional: /provisional/i.test(zip) };
}

const readCsv = async (path) => parse(await readFile(path, 'utf8'), { relax_column_count: true, skip_empty_lines: false });

/**
 * Fixture layout (test/fixtures/ons-pay/): each workbook is a folder of the same name, holding
 * one `<sheet>.csv` per sheet used, e.g. `ashe3/PROV - … Table 3.1a … 2026/Full-Time.csv` and
 * `rtisaoct2026/1. Payrolled employees (UK).csv`.
 */
async function readInputs(mode) {
  const dir = inputDir(SOURCE, mode);
  if (mode === 'fixture') {
    const ashe3 = join(dir, 'ashe3');
    const folders = await readdir(ashe3);
    const ashe = {};
    for (const [key, t] of Object.entries(ASHE_TABLES)) {
      const f = folders.find((n) => tableRe(t).test(n));
      if (!f) throw new Error(`fixture: no Table ${t} folder in ${ashe3}`);
      ashe[key] = await readCsv(join(ashe3, f, `${ASHE_SHEET}.csv`));
    }
    const rtiFolder = newest(await readdir(dir), /rtisa([a-z]{3})(\d{4})$/i, rtiKey);
    if (!rtiFolder) throw new Error(`fixture: no rtisa<mon><yyyy> folder in ${dir}`);
    const rti = {};
    for (const [key, sheet] of Object.entries(RTI_SHEETS)) rti[key] = await readCsv(join(dir, rtiFolder, `${sheet}.csv`));
    return { ashe, provisional: folders.some((n) => /^PROV\b/.test(n)), rti };
  }
  const { paths, provisional } = await asheWorkbooks(dir);
  const ashe = {};
  for (const [key, path] of Object.entries(paths)) ashe[key] = await (await readWorkbook(path)).sheet(ASHE_SHEET);
  const rtiName = newest(await readdir(dir), RTI_FILE, rtiKey);
  if (!rtiName) throw new Error(`${dir}: no rtisa<mon><yyyy>.xlsx. Run without --cached to download it.`);
  const wb = await readWorkbook(join(dir, rtiName));
  const rti = {};
  for (const [key, sheet] of Object.entries(RTI_SHEETS)) rti[key] = await wb.sheet(sheet);
  return { ashe, provisional, rti };
}

export async function run(mode) {
  if (mode === 'download') await fetchCurrent(inputDir(SOURCE, mode));
  const { ashe, provisional, rti } = await readInputs(mode);
  const data = buildPay(buildAshe(ashe, provisional), buildRti(rti));
  await writeJson(`features/${NAME}.json`, data);
  return `ASHE ${data.ashe.year}: UK £${data.ashe.ukFullTimeWeekly}/week, ${data.ashe.regions.length} regions, ${data.ashe.occupations.length} occupations; RTI ${data.rti.months.length} months to ${data.rti.flashLabel} (${mode})`;
}
