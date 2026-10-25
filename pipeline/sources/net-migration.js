// Net migration ("In and Out"): builds public/data/features/net-migration.json.
//
// Publisher: Office for National Statistics, "Long-term international immigration, emigration
// and net migration flows, provisional" (LTIM), UK, rolling years ending each quarter.
// Tables read: 1 (flows by nationality), 2 (95% uncertainty intervals), 4b (non-EU+ by reason
// on arrival) and 5 (revisions history; the "Revision for ..." difference rows are dropped).
// Licence: Open Government Licence v3.0. Cadence: twice a year (May: year ending December;
// November: year ending June). Each edition revises the previous four quarters, so the whole
// series is re-read every time. File names change every edition, so download mode finds the
// spreadsheet link on the dataset page (site.config.js URL) and names it ltim-<mon><yyyy>.xlsx;
// read modes take the newest ltim-*.xlsx in .cache/ons-ltim/.
//
// LTIM has no suppression markers: values are rounded to the nearest 1,000 and 0 means "under
// 500" (a real 0). Blank or non-numeric cells ("Not published") become null, never 0.

import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parse } from 'csv-parse/sync';
import { download, fetchText, findLinks } from '../lib/fetch.js';
import { readWorkbook } from '../lib/xlsx.js';
import { clean, expectColumns, inputDir, num, rowsUnder, writeJson } from '../lib/util.js';

const NAME = 'net-migration';
const SOURCE = 'ons-ltim';
const PAGE = 'https://www.ons.gov.uk/peoplepopulationandcommunity/populationandmigration/internationalmigration/datasets/longterminternationalimmigrationemigrationandnetmigrationflowsprovisional';
const SHEETS = ['1', '2', '4b', '5'];

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const NEW_METHOD_FROM = '2021-06';

/** "YE Dec 25 P R" → { key: "2025-12", label: "year ending December 2025", provisional, revised }. */
export function parsePeriod(cell) {
  const s = clean(cell);
  const m = /^YE (\w{3}) (\d\d)(.*)$/.exec(s);
  const month = m ? MONTHS.indexOf(m[1].toLowerCase()) : -1;
  if (!m || month === -1) throw new Error(`${NAME}: can't read period "${s}" (expected like "YE Dec 25 P")`);
  const year = 2000 + Number(m[2]);
  const flags = m[3].trim().split(/\s+/);
  return {
    key: `${year}-${String(month + 1).padStart(2, '0')}`,
    label: `year ending ${MONTH_NAMES[month]} ${year}`,
    provisional: flags.includes('P'),
    revised: flags.includes('R'),
  };
}

const FLOWS = { Immigration: 'immigration', Emigration: 'emigration', 'Net migration': 'net' };

/** Rows (objects) of a flow × period table → sorted periods and, per flow, a lookup by key. */
function byFlowAndPeriod(rows, what) {
  const periods = new Map();
  const values = { immigration: new Map(), emigration: new Map(), net: new Map() };
  for (const r of rows) {
    const flow = FLOWS[clean(r.Flow)];
    if (!flow) throw new Error(`${what}: unknown flow "${clean(r.Flow)}"`);
    const p = parsePeriod(r.Period);
    const seen = periods.get(p.key);
    // A period's flags can differ by flow in principle: provisional/revised if any row says so.
    periods.set(p.key, seen ? { ...seen, provisional: seen.provisional || p.provisional, revised: seen.revised || p.revised } : p);
    values[flow].set(p.key, r);
  }
  for (const [flow, m] of Object.entries(values)) if (m.size === 0) throw new Error(`${what}: no "${flow}" rows`);
  return { periods: [...periods.values()].sort((a, b) => a.key.localeCompare(b.key)), values };
}

const T1 = { all: 'All Nationalities', british: 'British', euPlus: 'EU+', nonEuPlus: 'Non-EU+' };

/** Table 1 grid → { periods, flows }. */
export function buildFlows(grid) {
  const rows = rowsUnder(grid, 'Flow', `${NAME} table 1`);
  if (rows.length === 0) throw new Error(`${NAME} table 1: no data rows`);
  expectColumns(rows[0], ['Flow', 'Period', ...Object.values(T1)], `${NAME} table 1`);
  const { periods, values } = byFlowAndPeriod(rows, `${NAME} table 1`);
  const flows = {};
  for (const flow of ['immigration', 'emigration', 'net']) {
    flows[flow] = Object.fromEntries(Object.entries(T1).map(([k, col]) => [k, periods.map((p) => num(values[flow].get(p.key)?.[col]))]));
  }
  return {
    periods: periods.map((p) => ({ key: p.key, label: p.label, provisional: p.provisional, revised: p.revised, newMethod: p.key >= NEW_METHOD_FROM })),
    flows,
  };
}

/** Table 2 grid → the latest net migration row with its 95% interval. */
export function buildInterval(grid) {
  const rows = rowsUnder(grid, 'Flow', `${NAME} table 2`);
  if (rows.length === 0) throw new Error(`${NAME} table 2: no data rows`);
  expectColumns(rows[0], ['Flow', 'Period', 'Estimate', 'Lower bound', 'Upper bound'], `${NAME} table 2`);
  const net = rows.filter((r) => clean(r.Flow) === 'Net migration').map((r) => ({ p: parsePeriod(r.Period), r }));
  if (net.length === 0) throw new Error(`${NAME} table 2: no "Net migration" rows`);
  const { p, r } = net.sort((a, b) => a.p.key.localeCompare(b.p.key)).at(-1);
  return { label: p.label, net: num(r.Estimate), lower: num(r['Lower bound']), upper: num(r['Upper bound']) };
}

// Subtotals (work, study, humanitarian) and their parts both kept: the page never adds both levels.
const T4B = {
  work: 'All Work Related',
  workMain: 'Work: Main applicant',
  workDependant: 'Work: Dependant',
  study: 'All Study Related',
  studyMain: 'Study: Main applicant',
  studyDependant: 'Study: Dependant',
  family: 'Family',
  humanitarian: 'All Humanitarian',
  asylum: 'Asylum',
  other: 'Other',
};

/** Table 4b grid → non-EU+ immigration and net by reason on arrival. */
export function buildReasons(grid) {
  const rows = rowsUnder(grid, 'Flow', `${NAME} table 4b`);
  if (rows.length === 0) throw new Error(`${NAME} table 4b: no data rows`);
  expectColumns(rows[0], ['Flow', 'Period', 'All reasons', ...Object.values(T4B)], `${NAME} table 4b`);
  const { periods, values } = byFlowAndPeriod(rows, `${NAME} table 4b`);
  const series = (flow) => Object.fromEntries(Object.entries(T4B).map(([k, col]) => [k, periods.map((p) => num(values[flow].get(p.key)?.[col]))]));
  return {
    periods: periods.map((p) => ({ key: p.key, label: p.label, provisional: p.provisional })),
    immigration: series('immigration'),
    net: series('net'),
  };
}

const T5 = ['Period', 'Publication', 'Estimate History', 'Net migration: All', 'Net migration: British', 'Emigration: British'];

/** Table 5 grid → stages for the most recent YE December with a completed estimate, else the latest period. */
export function buildRevision(grid) {
  const rows = rowsUnder(grid, 'Period', `${NAME} table 5`);
  if (rows.length === 0) throw new Error(`${NAME} table 5: no data rows`);
  expectColumns(rows[0], T5, `${NAME} table 5`);
  const byPeriod = new Map();
  for (const r of rows) {
    const history = clean(r['Estimate History']);
    // Drop difference rows and stages that were never published.
    if (/^Revision for/i.test(history) || num(r['Net migration: All']) === null) continue;
    const p = parsePeriod(r.Period);
    if (!byPeriod.has(p.key)) byPeriod.set(p.key, { p, stages: [] });
    const entry = byPeriod.get(p.key);
    // The same stage can be listed twice (a repeated block): keep the first.
    if (entry.stages.some((s) => s.history === history && s.publication === clean(r.Publication))) continue;
    entry.stages.push({ history, publication: clean(r.Publication), r });
  }
  if (byPeriod.size === 0) throw new Error(`${NAME} table 5: no published estimates`);
  const sorted = [...byPeriod.values()].sort((a, b) => a.p.key.localeCompare(b.p.key));
  const completedDec = sorted.filter((e) => e.p.key.endsWith('-12') && e.stages.some((s) => /^Completed/i.test(s.history)));
  const pick = completedDec.at(-1) ?? sorted.at(-1);
  const n = pick.stages.length;
  return {
    label: pick.p.label,
    stages: pick.stages.map((s, i) => ({
      stage: i === n - 1 && n > 1 ? 'Latest' : i === 0 ? 'First published' : 'Revised with 6 months of travel data',
      net: num(s.r['Net migration: All']),
      british: num(s.r['Net migration: British']),
      // Not in the contract's field list: the page's sentence needs British emigration itself.
      britishEmigration: num(s.r['Emigration: British']),
    })),
  };
}

/** Sheets as grids (rows of cells) → the page's data. */
export function buildNetMigration(sheets) {
  for (const s of SHEETS) if (!sheets[s]) throw new Error(`${NAME}: sheet "${s}" missing. Has the LTIM workbook changed?`);
  const { periods, flows } = buildFlows(sheets['1']);
  return {
    updated: periods.at(-1).label,
    periods,
    flows,
    interval: buildInterval(sheets['2']),
    reasons: buildReasons(sheets['4b']),
    revision: buildRevision(sheets['5']),
  };
}

/** "may2026publicationspreadsheet.xlsx" / "ltimnov25.xlsx" → "may2026". */
export function editionOf(name) {
  const m = new RegExp(`(${MONTHS.join('|')})[a-z]*[-_ ]?(\\d{4}|\\d\\d)(?!\\d)`, 'i').exec(name);
  if (!m) return null;
  return `${m[1].toLowerCase()}${m[2].length === 2 ? `20${m[2]}` : m[2]}`;
}

const editionRank = (e) => Number(e.slice(3)) * 12 + MONTHS.indexOf(e.slice(0, 3));

async function fetchCurrent() {
  const html = await fetchText(PAGE);
  const links = findLinks(html, PAGE, /\.xlsx(\?|$)/i);
  if (links.length === 0) throw new Error(`${NAME}: no .xlsx link on ${PAGE}`);
  // The dataset page lists the current edition first; previous versions sit on another page.
  const url = links[0];
  const file = decodeURIComponent(url).split('/').pop();
  const edition = editionOf(file) ?? editionOf(decodeURIComponent(url));
  if (!edition) throw new Error(`${NAME}: can't tell the edition from ${url}`);
  await download(url, join(inputDir(SOURCE, 'download'), `ltim-${edition}.xlsx`));
}

async function readSheets(mode) {
  const dir = inputDir(SOURCE, mode);
  if (mode === 'fixture') {
    const sheets = {};
    for (const s of SHEETS) sheets[s] = parse(await readFile(join(dir, `${s}.csv`), 'utf8'), { relax_column_count: true });
    return sheets;
  }
  const files = (await readdir(dir)).filter((f) => /^ltim-.*\.xlsx$/i.test(f) && editionOf(f));
  if (files.length === 0) throw new Error(`${NAME}: no ltim-<mon><yyyy>.xlsx in ${dir}`);
  const newest = files.sort((a, b) => editionRank(editionOf(a)) - editionRank(editionOf(b))).at(-1);
  const wb = await readWorkbook(join(dir, newest));
  const sheets = {};
  for (const s of SHEETS) if (wb.names.includes(s)) sheets[s] = await wb.sheet(s);
  return sheets;
}

export async function run(mode) {
  if (mode === 'download') await fetchCurrent();
  const data = buildNetMigration(await readSheets(mode));
  await writeJson(`features/${NAME}.json`, data);
  const last = data.periods.length - 1;
  return `${data.periods.length} periods to ${data.updated}, net ${data.flows.net.all[last]} (${mode})`;
}
