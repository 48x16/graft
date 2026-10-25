// Asylum Claims page: claims, initial decisions, grant rate, the queue awaiting an initial
// decision, and people on asylum support. Builds public/data/features/asylum.json.
//
// Publisher: Home Office, Immigration system statistics data tables ("Asylum and resettlement"),
// https://www.gov.uk/government/statistical-data-sets/immigration-system-statistics-data-tables
// Tables: Data_Asy_D01 (claims) and Data_Asy_D02 (initial decisions) in
// asylum-claims-datasets-<mon>-<yyyy>.xlsx; Data_Asy_D03 (awaiting a decision) in
// asylum-claims-awaiting-decision-datasets-….xlsx; Data_Asy_D09 (people on asylum support) in
// asylum-seekers-receipt-support-datasets-….xlsx; Asy_00a (headline series, cross-check only) in
// asylum-summary-…-tables.ods.
// Licence: Open Government Licence v3.0. Cadence: quarterly (late Feb, May, Aug, Nov).
//
// Rules (docs/plan.md "## asylum", docs/decisions.md):
// - Years ending June, built from quarters (YE June Y = Y-1 Q3 + Y-1 Q4 + Y Q1 + Y Q2). Only
//   years with all four quarters in the data; the first is YE June 2002.
// - Provisional: a year containing any quarter of the latest quarter's calendar year (the
//   publisher marks the current year, now 2026 Q1 onwards, as provisional).
// - Grant rate on main applicants (cases); claims, awaiting and support on people.
// - "Admin - Deceased" outcomes are dropped from every count.
// - The datasets have no suppression (cells go down to 1). A blank or non-numeric count cell is
//   treated as missing: any total it feeds becomes null, never 0. A category with no rows at a
//   date is a real zero (the datasets are long format and omit zero rows).
//
// In fixture mode the same sheets are read from CSV copies in test/fixtures/ho-asylum/, named
// asylum-<sheet>.csv (the asylum-support tool keeps its own files in the same folder).

import { readdir, readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { parse } from 'csv-parse/sync';
import { download, fetchText, findLink } from '../lib/fetch.js';
import { readWorkbook as readOds } from '../lib/ods.js';
import { readWorkbook as readXlsx } from '../lib/xlsx.js';
import { clean, expectColumns, inputDir, num, rowsUnder, writeJson } from '../lib/util.js';

const NAME = 'asylum';
const SOURCE = 'ho-asylum';
const PAGE = 'https://www.gov.uk/government/statistical-data-sets/immigration-system-statistics-data-tables';

// Each workbook: how to find it (on the page and in the folder) and the sheets read from it.
const FILES = {
  claims: { pattern: /\/asylum-claims-datasets-[a-z]+-\d{4}\.xlsx$/i, sheets: ['Data_Asy_D01', 'Data_Asy_D02'] },
  awaiting: { pattern: /\/asylum-claims-awaiting-decision-datasets-[a-z]+-\d{4}\.xlsx$/i, sheets: ['Data_Asy_D03'] },
  support: { pattern: /\/asylum-seekers-receipt-support-datasets-[a-z]+-\d{4}\.xlsx$/i, sheets: ['Data_Asy_D09'] },
  summary: { pattern: /\/asylum-summary-[a-z]+-\d{4}-tables\.ods$/i, sheets: ['Asy_00a'], optional: true },
};

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

// --- small helpers -------------------------------------------------------------------------

/** "2026 Q2" → { year: 2026, q: 2 }, or throws. */
export function parseQuarter(s) {
  const m = /^(\d{4}) Q([1-4])$/.exec(String(s).trim());
  if (!m) throw new Error(`asylum: quarter "${s}" is not like "2026 Q2"`);
  return { year: Number(m[1]), q: Number(m[2]) };
}

/** The year ending June a quarter belongs to: Q3 and Q4 count towards the next year. */
const yeJune = ({ year, q }) => (q >= 3 ? year + 1 : year);

/** "30 Jun 2010" → { key: "2010-06-30", label: "30 June 2010" }, or throws. */
export function parseAsAt(s) {
  const m = /^(\d{1,2}) ([A-Za-z]{3})[a-z]* (\d{4})$/.exec(String(s).trim());
  const month = m ? MONTHS.findIndex((x) => x.slice(0, 3).toLowerCase() === m[2].toLowerCase()) : -1;
  if (month === -1) throw new Error(`asylum: date "${s}" is not like "30 Jun 2026"`);
  const day = Number(m[1]);
  return { key: `${m[3]}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`, label: `${day} ${MONTHS[month]} ${m[3]}` };
}

/** Adds a count to a total that turns null for good once a missing cell is met. */
const add = (total, cell) => {
  const n = num(cell);
  return total === null || n === null ? null : (total ?? 0) + n;
};

/** Checks that every value in `col` is one we know, so a renamed category fails loudly. */
function expectValues(rows, col, known, what) {
  const unknown = [...new Set(rows.map((r) => r[col]))].filter((v) => !known.includes(v));
  if (unknown.length) throw new Error(`${what}: unexpected ${col} value${unknown.length > 1 ? 's' : ''} ${unknown.map((v) => `"${v}"`).join(', ')}. Has the table changed?`);
}

/**
 * Years ending June from quarterly rows: every YE with all four quarters present, oldest first,
 * and a function giving a row's index in that list (or -1).
 */
function yearsFrom(rows) {
  const quarters = new Set(rows.map((r) => r.Quarter));
  const parsed = [...quarters].map(parseQuarter);
  const latest = parsed.reduce((a, b) => (b.year * 4 + b.q > a.year * 4 + a.q ? b : a));
  const yes = [...new Set(parsed.map(yeJune))].sort((a, b) => a - b);
  const has = (y, q) => quarters.has(`${y} Q${q}`);
  const full = (Y) => has(Y - 1, 3) && has(Y - 1, 4) && has(Y, 1) && has(Y, 2);
  const first = yes.find(full);
  const last = [...yes].reverse().find(full);
  if (first === undefined) throw new Error('asylum: no complete year ending June in the claims data');
  const years = [];
  for (let Y = first; Y <= last; Y++) {
    years.push({ year: Y, label: `year ending June ${Y}`, provisional: Y >= latest.year });
  }
  // A year in the middle with a quarter missing stays in the list (so arrays stay aligned) but
  // its totals are null: `complete` says which.
  const complete = years.map((y) => full(y.year));
  const index = new Map(years.map((y, i) => [y.year, i]));
  const at = (row) => index.get(yeJune(parseQuarter(row.Quarter))) ?? -1;
  return { years, complete, at, has };
}

// --- the build -----------------------------------------------------------------------------

const D01 = ['Year', 'Quarter', 'Nationality', 'Region', 'Age', 'Sex', 'Applicant type', 'UASC', 'Location of claim', 'Claims'];
const D02 = ['Year', 'Quarter', 'Nationality', 'Region', 'Case outcome group', 'Case outcome', 'Age', 'Sex', 'Applicant type', 'UASC', 'Decisions'];
const D03 = ['Date (as at...)', 'Nationality', 'Region', 'Sex', 'Applicant type', 'Application stage', 'Duration', 'Claims'];
const D09 = ['Date (as at…)', 'Nationality', 'Region', 'Support Type', 'Accommodation Type', 'UK Region / Nation', 'People'];

const APPLICANT = ['Main Applicant', 'Dependant'];
const GROUPS = ['Grant of Protection', 'Grant of Other Leave', 'Refused', 'Withdrawn', 'Administrative Outcome'];
const DURATIONS = { 'Less than 3 months': 'under3m', '3 months to less than 6 months': '3to6m', '6 months to less than 12 months': '6to12m', '12 months or more': '12mPlus' };
const STAGES = ['Pending initial decision', 'Pending further review'];
const HOTEL = 'Contingency Accommodation - Hotel';
const EXCLUDED_NATIONALITIES = /^(other|unknown)\b/i; // "Other and unknown" residual; Refugee and Stateless stay
const MIN_RATE_BASE = 50; // grant rate shown for a nationality only on 50+ main-applicant grants and refusals
const TOP = 10;

/** Claims and decisions by year ending June (D01, D02), plus the latest year's top nationalities. */
export function buildClaimsAndDecisions(d01, d02) {
  if (!d01.length) throw new Error('asylum: Data_Asy_D01 has no rows');
  if (!d02.length) throw new Error('asylum: Data_Asy_D02 has no rows');
  expectColumns(d01[0], D01, 'asylum Data_Asy_D01');
  expectColumns(d02[0], D02, 'asylum Data_Asy_D02');
  expectValues(d01, 'Applicant type', APPLICANT, 'asylum Data_Asy_D01');
  expectValues(d02, 'Applicant type', APPLICANT, 'asylum Data_Asy_D02');
  expectValues(d02, 'Case outcome group', GROUPS, 'asylum Data_Asy_D02');
  if (!d02.some((r) => r['Case outcome'] === 'Refugee Permission')) throw new Error('asylum Data_Asy_D02: no "Refugee Permission" outcome. Has the table changed?');

  const { years, complete, at } = yearsFrom(d01);
  const blank = () => years.map((_, i) => (complete[i] ? 0 : null));

  // Claims. Ages "Unknown Age" and "Unknown age" are two spellings of one group; as every
  // age/sex/UASC/location row is summed here, merging them needs no work. People = all applicant
  // types, but null for a year with any quarter before the first quarter that records dependants
  // (2002 Q1). After that, a quarter with no Dependant rows is a real zero.
  const people = blank();
  const main = blank();
  const qnum = (s) => { const p = parseQuarter(s); return p.year * 4 + p.q; };
  const firstDep = Math.min(...d01.filter((r) => r['Applicant type'] === 'Dependant').map((r) => qnum(r.Quarter)));
  for (const r of d01) {
    const i = at(r);
    if (i === -1 || !complete[i]) continue;
    people[i] = add(people[i], r.Claims);
    if (r['Applicant type'] === 'Main Applicant') main[i] = add(main[i], r.Claims);
  }
  years.forEach((y, i) => {
    if (qnum(`${y.year - 1} Q3`) < firstDep) people[i] = null;
  });

  // Initial decisions. Admin - Deceased rows are dropped before anything is counted.
  const kept = d02.filter((r) => r['Case outcome'] !== 'Admin - Deceased');
  const dyears = yearsFrom(d02);
  const di = (r) => years.findIndex((y) => y.year === yeJune(parseQuarter(r.Quarter)));
  const dcomplete = years.map((y) => dyears.has(y.year - 1, 3) && dyears.has(y.year - 1, 4) && dyears.has(y.year, 1) && dyears.has(y.year, 2));
  const dblank = () => years.map((_, i) => (dcomplete[i] ? 0 : null));
  const protection = dblank();
  const otherLeave = dblank();
  const refused = dblank();
  const withdrawn = dblank();
  const decisionsPeople = dblank();
  const byGroup = { 'Grant of Protection': protection, 'Grant of Other Leave': otherLeave, Refused: refused, Withdrawn: withdrawn };
  for (const r of kept) {
    const i = di(r);
    if (i === -1 || !dcomplete[i]) continue;
    decisionsPeople[i] = add(decisionsPeople[i], r.Decisions);
    const series = byGroup[r['Case outcome group']];
    if (series && r['Applicant type'] === 'Main Applicant') series[i] = add(series[i], r.Decisions);
  }
  const grantRate = years.map((_, i) => {
    const grants = protection[i] === null || otherLeave[i] === null ? null : protection[i] + otherLeave[i];
    const base = grants === null || refused[i] === null ? null : grants + refused[i];
    return base ? grants / base : null;
  });

  // Nationalities in the latest year: top ten by people claiming, grant rate on main applicants.
  const last = years.at(-1).year;
  const inLast = (r) => yeJune(parseQuarter(r.Quarter)) === last;
  const nat = new Map();
  const get = (name) => nat.get(name) ?? nat.set(name, { name, claims: 0, grants: 0, refused: 0 }).get(name);
  for (const r of d01) if (inLast(r)) get(r.Nationality).claims = add(get(r.Nationality).claims, r.Claims);
  for (const r of kept) {
    if (!inLast(r) || r['Applicant type'] !== 'Main Applicant') continue;
    const g = r['Case outcome group'];
    if (g === 'Grant of Protection' || g === 'Grant of Other Leave') get(r.Nationality).grants = add(get(r.Nationality).grants, r.Decisions);
    else if (g === 'Refused') get(r.Nationality).refused = add(get(r.Nationality).refused, r.Decisions);
  }
  const nationalities = [...nat.values()]
    .filter((n) => !EXCLUDED_NATIONALITIES.test(n.name) && n.claims !== null && n.claims > 0)
    .sort((a, b) => b.claims - a.claims || a.name.localeCompare(b.name))
    .slice(0, TOP)
    .map((n) => {
      const decisions = n.grants === null || n.refused === null ? null : n.grants + n.refused;
      return { name: n.name, claims: n.claims, decisions, grantRate: decisions !== null && decisions >= MIN_RATE_BASE ? n.grants / decisions : null };
    });

  return { years, claims: { people, mainApplicants: main }, decisions: { protection, otherLeave, refused, withdrawn, grantRate }, decisionsPeople, nationalities };
}

/** People and cases awaiting an initial decision at each quarter end (D03). */
export function buildAwaiting(d03) {
  if (!d03.length) throw new Error('asylum: Data_Asy_D03 has no rows');
  expectColumns(d03[0], D03, 'asylum Data_Asy_D03');
  expectValues(d03, 'Application stage', STAGES, 'asylum Data_Asy_D03');
  expectValues(d03, 'Applicant type', APPLICANT, 'asylum Data_Asy_D03');
  const keys = new Map(); // key → { key, label }
  for (const r of d03) {
    const d = parseAsAt(r['Date (as at...)']);
    keys.set(d.key, d);
  }
  const dates = [...keys.values()].sort((a, b) => a.key.localeCompare(b.key));
  const index = new Map(dates.map((d, i) => [d.key, i]));
  const zeros = () => dates.map(() => 0); // a date with no rows for a group is a real zero
  const people = zeros();
  const cases = zeros();
  const byDuration = Object.fromEntries(Object.values(DURATIONS).map((k) => [k, zeros()]));
  // Further reviews (2010 to 2022 only) are left out throughout, or the older totals run high.
  for (const r of d03.filter((x) => x['Application stage'] === 'Pending initial decision')) {
    const i = index.get(parseAsAt(r['Date (as at...)']).key);
    const band = DURATIONS[r.Duration];
    if (!band) throw new Error(`asylum Data_Asy_D03: unexpected Duration "${r.Duration}" for a claim pending initial decision`);
    people[i] = add(people[i], r.Claims);
    byDuration[band][i] = add(byDuration[band][i], r.Claims);
    if (r['Applicant type'] === 'Main Applicant') cases[i] = add(cases[i], r.Claims);
  }
  return { dates, people, cases, byDuration };
}

/** People on asylum support at each quarter end, and those in hotels (D09). */
export function buildSupport(d09) {
  if (!d09.length) throw new Error('asylum: Data_Asy_D09 has no rows');
  expectColumns(d09[0], D09, 'asylum Data_Asy_D09');
  if (!d09.some((r) => r['Accommodation Type'] === HOTEL)) throw new Error(`asylum Data_Asy_D09: no "${HOTEL}" rows. Has the table changed?`);
  const keys = new Map();
  for (const r of d09) {
    const d = parseAsAt(r['Date (as at…)']);
    keys.set(d.key, d);
  }
  const dates = [...keys.values()].sort((a, b) => a.key.localeCompare(b.key));
  const index = new Map(dates.map((d, i) => [d.key, i]));
  const people = dates.map(() => 0);
  const hotels = dates.map(() => 0);
  // Every row counts towards people, including the "N/A - …" placeholder regions and
  // nationalities: they are real people whose area or nationality was not recorded.
  for (const r of d09) {
    const i = index.get(parseAsAt(r['Date (as at…)']).key);
    people[i] = add(people[i], r.People);
    if (r['Accommodation Type'] === HOTEL) hotels[i] = add(hotels[i], r.People);
  }
  // Hotels are null before the first date with any hotel row (not recorded then), 0 after.
  const first = dates.findIndex((d) => d09.some((r) => r['Accommodation Type'] === HOTEL && parseAsAt(r['Date (as at…)']).key === d.key));
  for (let i = 0; i < first; i++) hotels[i] = null;
  return { dates, people, hotels };
}

/** The whole page: exactly the contract in docs/plan.md, in its order. */
export function buildAsylum({ d01, d02, d03, d09 }) {
  const cd = buildClaimsAndDecisions(d01, d02);
  return {
    updated: cd.years.at(-1).label,
    years: cd.years,
    claims: cd.claims,
    decisions: cd.decisions,
    decisionsPeople: cd.decisionsPeople,
    awaiting: buildAwaiting(d03),
    nationalities: cd.nationalities,
    support: buildSupport(d09),
  };
}

/**
 * Compares the latest year with the publisher's own headline table (Asy_00a). Returns a list of
 * mismatches (empty when all agree); the caller only warns.
 */
export function crossCheck(data, asy00a) {
  const label = data.updated.replace(/^year/, 'Year');
  const rows = rowsUnder(asy00a, 'Date / As at the end of...', 'asylum Asy_00a');
  if (!rows.length || !(label in rows[0])) return [`Asy_00a has no "${label}" column`];
  const row = (name) => rows.find((r) => clean(r['Date / As at the end of...']) === name)?.[label];
  const i = data.years.length - 1;
  const a = data.awaiting.people.length - 1;
  const s = data.support.people.length - 1;
  const checks = [
    ['People claiming asylum', data.claims.people[i]],
    ['Grant rate at initial decision', data.decisions.grantRate[i], 0.0005],
    ['People awaiting an initial decision', data.awaiting.people[a]],
    ['Cases awaiting an initial decision', data.awaiting.cases[a]],
    ['Asylum seekers in receipt of support', data.support.people[s]],
    ['Of which accommodated in hotels', data.support.hotels[s]],
  ];
  const out = [];
  for (const [name, ours, tol = 0] of checks) {
    const theirs = num(row(name));
    if (theirs === null) out.push(`Asy_00a: no figure for "${name}"`);
    else if (ours === null || Math.abs(ours - theirs) > tol) out.push(`${name}: ours ${ours}, Asy_00a ${theirs}`);
  }
  return out;
}

// --- reading files -------------------------------------------------------------------------

/** The newest edition in `dir` whose name matches `pattern` (by the month and year in its name). */
async function newest(dir, pattern) {
  const names = (await readdir(dir).catch(() => [])).filter((f) => pattern.test(`/${f}`));
  if (!names.length) return null;
  const edition = (f) => {
    const m = /-([a-z]{3})-(\d{4})/i.exec(f);
    const month = m ? MONTHS.findIndex((x) => x.slice(0, 3).toLowerCase() === m[1].toLowerCase()) : -1;
    return m ? Number(m[2]) * 12 + month : -1;
  };
  const scored = await Promise.all(names.map(async (f) => ({ f, e: edition(f), t: (await stat(join(dir, f))).mtimeMs })));
  scored.sort((a, b) => a.e - b.e || a.t - b.t);
  return join(dir, scored.at(-1).f);
}

/** One sheet as rows of strings (title row, header row, data). */
async function readSheet(dir, mode, file, sheet) {
  if (mode === 'fixture') {
    const path = join(dir, `asylum-${sheet}.csv`);
    try {
      return parse(await readFile(path, 'utf8'), { relax_column_count: true, skip_empty_lines: true, bom: true });
    } catch (err) {
      if (FILES[file].optional && err.code === 'ENOENT') return null;
      throw err;
    }
  }
  const path = await newest(dir, FILES[file].pattern);
  if (!path) {
    if (FILES[file].optional) return null;
    throw new Error(`asylum: no file matching ${FILES[file].pattern} in ${dir}. Run without --cached to download it.`);
  }
  const wb = path.endsWith('.ods') ? await readOds(path) : await readXlsx(path);
  return wb.sheet(sheet);
}

async function downloadAll(dir) {
  const html = await fetchText(PAGE);
  for (const f of Object.values(FILES)) {
    const url = findLink(html, PAGE, f.pattern);
    await download(url, join(dir, decodeURIComponent(new URL(url).pathname).split('/').pop()));
  }
}

export async function run(mode) {
  const dir = inputDir(SOURCE, mode);
  if (mode === 'download') await downloadAll(dir);
  const sheet = async (file, name, first) => {
    const rows = await readSheet(dir, mode, file, name);
    return rows && rowsUnder(rows, first, `asylum ${name}`);
  };
  const data = buildAsylum({
    d01: await sheet('claims', 'Data_Asy_D01', 'Year'),
    d02: await sheet('claims', 'Data_Asy_D02', 'Year'),
    d03: await sheet('awaiting', 'Data_Asy_D03', 'Date (as at...)'),
    d09: await sheet('support', 'Data_Asy_D09', 'Date (as at…)'),
  });
  const asy00a = await readSheet(dir, mode, 'summary', 'Asy_00a');
  if (asy00a) for (const w of crossCheck(data, asy00a)) console.warn(`asylum: warning: ${w}`);
  await writeJson(`features/${NAME}.json`, data);
  const i = data.years.length - 1;
  return `${data.years.length} years to ${data.updated}: ${data.claims.people[i]} people claimed, grant rate ${data.decisions.grantRate[i]?.toFixed(3)}, ${data.awaiting.people.at(-1)} awaiting, ${data.support.people.at(-1)} on support (${mode})`;
}
