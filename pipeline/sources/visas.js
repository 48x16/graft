// Visas Issued: builds public/data/features/visas.json for visas.html.
//
// Publisher: Home Office, Immigration system statistics (quarterly; published with each edition,
// late February, May, August and November).
// - ho-visas: "Entry clearance visa applications and outcomes detailed datasets"
//   (entry-clearance-visa-outcomes-datasets-<mon>-<yyyy>.xlsx), sheet Data_Vis_D02: outcomes of
//   entry clearance visa applications, quarterly from 2005 Q1. Accredited official statistics.
//   The summary tables (visas-summary-<mon>-<yyyy>-tables.ods, Vis_01) are read only to
//   cross-check the latest year's work visas (a warning, never a failure).
// - ho-work-occupation: "Sponsored work visas by occupation and industry" SOC 2020 dataset
//   (occupation-soc2020-visas-datasets-<mon>-<yyyy>.xlsx), sheet Data_Occ_D02: grants to main
//   applicants by occupation, quarterly from 2021 Q1. Not accredited; 2021 Q1 to 2024 Q3 modelled.
// Licence: Open Government Licence v3.0 (Crown copyright).
//
// Every series is a year ending June, built from quarters (YE June Y = Y-1 Q3 + Y-1 Q4 + Y Q1 +
// Y Q2). The publisher marks the latest two quarters ("2026 Q1 onwards") as provisional.

import { readdir, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { parse } from 'csv-parse/sync';
import { download, fetchText, findLink } from '../lib/fetch.js';
import { readWorkbook as readOds } from '../lib/ods.js';
import { expectColumns, inputDir, num, rowsUnder, writeJson } from '../lib/util.js';
import { readWorkbook as readXlsx } from '../lib/xlsx.js';

const NAME = 'visas';
const PAGE_URL = 'https://www.gov.uk/government/statistical-data-sets/immigration-system-statistics-data-tables';
const FILES = {
  outcomes: { source: 'ho-visas', pattern: /\/entry-clearance-visa-outcomes-datasets-([a-z]{3})-(\d{4})\.xlsx$/i, sheet: 'Data_Vis_D02' },
  summary: { source: 'ho-visas', pattern: /\/visas-summary-([a-z]{3})-(\d{4})-tables\.ods$/i, sheet: 'Vis_01' },
  occupation: { source: 'ho-work-occupation', pattern: /\/occupation-soc2020-visas-datasets-([a-z]{3})-(\d{4})\.xlsx$/i, sheet: 'Data_Occ_D02' },
};

const GROUPS = ['Work', 'Study', 'Family', 'Visitor', 'Other'];
const HEALTH_CARE = 'Health and Care Worker';
const SKILLED = 'Skilled Worker';
const SEASONAL = 'Seasonal Worker';
const ROUTES_FROM = '2020 Q4'; // Skilled Worker and Health and Care Worker open in December 2020
const TOP_JOBS = 15;
const MONTHS = ['January to March', 'April to June', 'July to September', 'October to December'];

// ---------------------------------------------------------------- periods

/** "2026 Q2" → a running quarter number (year × 4 + quarter − 1). Throws on anything else. */
export function quarterIndex(key) {
  const m = /^(\d{4}) Q([1-4])$/.exec(String(key ?? '').trim());
  if (!m) throw new Error(`visas: quarter "${key}" is not like "2026 Q2"`);
  return Number(m[1]) * 4 + Number(m[2]) - 1;
}
const quarterKey = (i) => `${Math.floor(i / 4)} Q${(i % 4) + 1}`;
const quarterLabel = (i) => `${MONTHS[i % 4]} ${Math.floor(i / 4)}`;
/** The four quarters of the year ending June `year`. */
const yeQuarters = (year) => [year * 4 - 2, year * 4 - 1, year * 4, year * 4 + 1];
const yeLabel = (year) => `year ending June ${year}`;

/**
 * The years ending June that the quarters on file cover in full, oldest first. `present` is the
 * set of quarter numbers that have any rows; a year with a quarter missing inside the range is
 * kept (so the arrays stay continuous) but its sums come out null.
 */
export function yearsEndingJune(first, latest) {
  const out = [];
  for (let y = Math.ceil((first + 2) / 4); y * 4 + 1 <= latest; y++) {
    if (y * 4 - 2 >= first) out.push(y);
  }
  return out;
}

/** Sums of a per-quarter Map over each year ending June; null if any quarter has no data at all. */
function yeSums(byQuarter, years, present) {
  return years.map((y) => {
    const qs = yeQuarters(y);
    if (!qs.every((q) => present.has(q))) return null;
    return qs.reduce((s, q) => s + (byQuarter?.get(q) ?? 0), 0);
  });
}

function add(store, key, q, value) {
  let m = store.get(key);
  if (!m) store.set(key, (m = new Map()));
  m.set(q, (m.get(q) ?? 0) + value);
}

const periodObjects = (years, latest) => years.map((year) => ({ year, label: yeLabel(year), provisional: Math.max(...yeQuarters(year)) >= latest - 1 }));

// ---------------------------------------------------------------- Vis_D02

const VIS_COLUMNS = ['Year', 'Quarter', 'Nationality', 'Visa type group', 'Visa type subgroup', 'Applicant type', 'Case outcome', 'Decisions'];

/** Data_Vis_D02 as a grid (title rows, then the header starting "Year") → the visa half of the page. */
export function buildVisaOutcomes(grid) {
  const rows = rowsUnder(grid, 'Year', 'visas Data_Vis_D02');
  if (rows.length === 0) throw new Error('visas Data_Vis_D02: no data rows');
  expectColumns(rows[0], VIS_COLUMNS, 'visas Data_Vis_D02');

  const present = new Set();
  const issued = new Map(); // group → quarter → n
  const refused = new Map();
  const workByApplicant = new Map(); // Main Applicant / Dependant / All → quarter → n
  const routes = new Map(); // "subgroup|applicant" → quarter → n
  const subgroups = new Set();
  for (const r of rows) {
    const q = quarterIndex(r.Quarter);
    present.add(q);
    const group = String(r['Visa type group']).trim();
    if (!GROUPS.includes(group)) throw new Error(`visas Data_Vis_D02: unknown Visa type group "${group}"`);
    const outcome = String(r['Case outcome']).trim();
    const subgroup = String(r['Visa type subgroup']).trim();
    const applicant = String(r['Applicant type']).trim();
    subgroups.add(subgroup);
    // The detailed dataset has no suppression markers; a blank count adds nothing.
    const n = num(r.Decisions) ?? 0;
    if (outcome === 'Issued') {
      add(issued, group, q, n);
      if (group === 'Work') add(workByApplicant, applicant, q, n);
      if (subgroup === HEALTH_CARE || subgroup === SKILLED) add(routes, `${subgroup}|${applicant}`, q, n);
    } else if (outcome === 'Refused') add(refused, group, q, n);
  }
  if (!issued.size) throw new Error('visas Data_Vis_D02: no "Issued" rows. Has the Case outcome wording changed?');
  for (const s of [HEALTH_CARE, SKILLED]) if (!subgroups.has(s)) throw new Error(`visas Data_Vis_D02: no "${s}" subgroup`);

  const first = Math.min(...present);
  const latest = Math.max(...present);
  const years = yearsEndingJune(first, latest);
  if (years.length === 0) throw new Error('visas Data_Vis_D02: not one full year ending June');
  const last = years.at(-1);
  const sumsOf = (m) => yeSums(m, years, present);

  const grants = { total: [] };
  for (const g of GROUPS) grants[g.toLowerCase()] = sumsOf(issued.get(g));
  grants.total = years.map((_, i) => (GROUPS.some((g) => grants[g.toLowerCase()][i] === null) ? null : GROUPS.reduce((s, g) => s + grants[g.toLowerCase()][i], 0)));

  // Work is split into main applicants and dependants. Any year with "All" rows can't be split.
  const allRows = sumsOf(workByApplicant.get('All'));
  const work = {
    main: sumsOf(workByApplicant.get('Main Applicant')).map((v, i) => (allRows[i] ? null : v)),
    dependant: sumsOf(workByApplicant.get('Dependant')).map((v, i) => (allRows[i] ? null : v)),
  };

  const lastSum = (m) => yeSums(m, [last], present)[0];
  const rate = (iss, ref) => (iss !== null && ref !== null && iss + ref > 0 ? iss / (iss + ref) : null);
  const grantRate = {};
  for (const g of GROUPS.slice(0, 4)) grantRate[g.toLowerCase()] = rate(lastSum(issued.get(g)), lastSum(refused.get(g)));
  const totalOf = (store) => GROUPS.reduce((s, g) => (s === null || lastSum(store.get(g)) === null ? null : s + lastSum(store.get(g))), 0);
  grantRate.all = rate(totalOf(issued), totalOf(refused));

  const quarterNums = [];
  for (let q = Math.max(first, quarterIndex(ROUTES_FROM)); q <= latest; q++) quarterNums.push(q);
  const routeSeries = (subgroup, applicant) => quarterNums.map((q) => (present.has(q) ? (routes.get(`${subgroup}|${applicant}`)?.get(q) ?? 0) : null));
  const routeYe = (subgroup, applicant) => lastSum(routes.get(`${subgroup}|${applicant}`));

  return {
    updated: yeLabel(last),
    years: periodObjects(years, latest),
    grants,
    work,
    grantRate,
    quarters: quarterNums.map((q) => ({ key: quarterKey(q), label: quarterLabel(q), provisional: q >= latest - 1 })),
    routes: {
      healthCareMain: routeSeries(HEALTH_CARE, 'Main Applicant'),
      healthCareDependant: routeSeries(HEALTH_CARE, 'Dependant'),
      skilledMain: routeSeries(SKILLED, 'Main Applicant'),
      skilledDependant: routeSeries(SKILLED, 'Dependant'),
    },
    routeShares: {
      healthCare: { main: routeYe(HEALTH_CARE, 'Main Applicant'), dependant: routeYe(HEALTH_CARE, 'Dependant') },
      skilled: { main: routeYe(SKILLED, 'Main Applicant'), dependant: routeYe(SKILLED, 'Dependant') },
    },
  };
}

// ---------------------------------------------------------------- Occ_D02

const OCC_COLUMNS = ['Year', 'Quarter', 'Visa type subgroup', 'Industry', 'Occ. minor group', 'Occ. unit group', 'Grants'];

/** "613 - Caring Personal Services" → { code: "613", name: "Caring Personal Services" }; "*" → null. */
export function splitLabel(label) {
  const s = String(label ?? '').trim();
  if (s === '' || s === '*') return null;
  const i = s.indexOf(' - ');
  if (i === -1) return { code: s, name: s };
  return { code: s.slice(0, i).trim(), name: s.slice(i + 3).trim() };
}

/** The subgroup in the publisher's current words: "Seasonal Worker (previously Tier 5)" → "Seasonal Worker". */
export const routeName = (subgroup) => {
  const s = String(subgroup ?? '').trim();
  return s.startsWith('Seasonal Worker') ? SEASONAL : s;
};

/** Data_Occ_D02 as a grid → the occupation block (main applicants only). */
export function buildOccupation(grid) {
  const rows = rowsUnder(grid, 'Year', 'visas Data_Occ_D02');
  if (rows.length === 0) throw new Error('visas Data_Occ_D02: no data rows');
  expectColumns(rows[0], OCC_COLUMNS, 'visas Data_Occ_D02');
  // Industry isn't shown, so the stray duplicate "Administrative and Support Activities" label
  // needs no merging here; it would be merged into "Administrative and Support Service
  // Activities" if industry were ever added.

  const present = new Set();
  const minor = new Map(); // Health and Care Worker: care / nurses / doctors / other → quarter → n
  const units = new Map(); // "code|name" → quarter → n (Skilled Worker + Health and Care Worker)
  const sponsored = new Map(); // route → quarter → n
  for (const r of rows) {
    const q = quarterIndex(r.Quarter);
    present.add(q);
    // "*" in Grants is "not available": it adds nothing to a total (treated as 0 in sums only).
    const n = num(r.Grants) ?? 0;
    const route = routeName(r['Visa type subgroup']);
    add(sponsored, route, q, n);
    if (route === HEALTH_CARE) {
      const code = splitLabel(r['Occ. minor group'])?.code;
      const group = code === '613' ? 'care' : code === '223' ? 'nurses' : code === '221' ? 'doctors' : 'other';
      add(minor, group, q, n);
    }
    if (route === HEALTH_CARE || route === SKILLED) {
      const unit = splitLabel(r['Occ. unit group']); // "*" before 2024 Q4 (modelled): left out
      if (unit) add(units, `${unit.code}|${unit.name}`, q, n);
    }
  }
  if (!sponsored.has(HEALTH_CARE) || !sponsored.has(SKILLED)) throw new Error('visas Data_Occ_D02: no Skilled Worker or Health and Care Worker rows');

  const first = Math.min(...present);
  const latest = Math.max(...present);
  const years = yearsEndingJune(first, latest);
  if (years.length === 0) throw new Error('visas Data_Occ_D02: not one full year ending June');
  const last = years.at(-1);
  const lastSum = (m) => yeSums(m, [last], present)[0];

  const topJobs = [...units.entries()]
    .map(([k, m]) => {
      const [code, name] = k.split('|');
      return { code, name, grants: lastSum(m) };
    })
    .filter((j) => j.grants !== null && j.grants > 0)
    .sort((a, b) => b.grants - a.grants || a.code.localeCompare(b.code))
    .slice(0, TOP_JOBS);

  const named = [SEASONAL, SKILLED, HEALTH_CARE].map((route) => ({ route, grants: lastSum(sponsored.get(route)) ?? 0 }));
  const otherSum = [...sponsored.entries()].filter(([k]) => ![SEASONAL, SKILLED, HEALTH_CARE].includes(k)).reduce((s, [, m]) => s + (lastSum(m) ?? 0), 0);
  const sponsoredRoutes = [...named.sort((a, b) => b.grants - a.grants), { route: 'Other sponsored routes', grants: otherSum }];
  const complete = yeQuarters(last).every((q) => present.has(q));

  return {
    years: periodObjects(years, latest),
    healthCareByGroup: Object.fromEntries(['care', 'nurses', 'doctors', 'other'].map((g) => [g, yeSums(minor.get(g), years, present)])),
    topJobs: complete ? topJobs : [],
    sponsoredRoutes: complete ? sponsoredRoutes : [],
    sponsoredTotal: complete ? sponsoredRoutes.reduce((s, r) => s + r.grants, 0) : null,
  };
}

/** Both halves → the page's JSON, in the contract's order. */
export function buildVisas(visGrid, occGrid) {
  const v = buildVisaOutcomes(visGrid);
  return { ...v, occupation: buildOccupation(occGrid) };
}

/** Vis_01 (summary ODS) → the work visas for "Year ending June <year>", or null if not found. */
export function summaryWork(grid, year) {
  const rows = rowsUnder(grid, 'Visa type', 'visas Vis_01');
  const row = rows.find((r) => String(r['Visa type']).trim() === 'Work visas');
  return row ? num(row[`Year ending June ${year}`]) : null;
}

// ---------------------------------------------------------------- files

const EDITION_MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

/** The newest file in `dir` matching the edition pattern (by its month and year), or null. */
async function newestFile(dir, pattern) {
  let names = [];
  try {
    names = await readdir(dir);
  } catch {
    return null;
  }
  const dated = names
    .map((n) => ({ n, m: pattern.exec(`/${n}`) }))
    .filter((x) => x.m)
    .map((x) => ({ n: x.n, t: Number(x.m[2]) * 12 + EDITION_MONTHS.indexOf(x.m[1].toLowerCase()) }))
    .sort((a, b) => b.t - a.t);
  return dated.length ? join(dir, dated[0].n) : null;
}

async function downloadAll() {
  const html = await fetchText(PAGE_URL);
  for (const f of Object.values(FILES)) {
    const url = findLink(html, PAGE_URL, f.pattern);
    const dir = inputDir(f.source, 'download');
    const fileName = decodeURIComponent(new URL(url).pathname.split('/').pop());
    // Clear older editions of the same file, so the cache holds one of each.
    for (const n of await readdir(dir).catch(() => [])) if (f.pattern.test(`/${n}`) && n !== fileName) await rm(join(dir, n));
    await download(url, join(dir, fileName));
  }
}

async function readGrid(f, mode) {
  const dir = inputDir(f.source, mode);
  if (mode === 'fixture') {
    // Fixtures are the sheet saved as CSV (<sheet>.csv), title rows and all.
    const text = await readFile(join(dir, `${f.sheet}.csv`), 'utf8');
    return parse(text, { relax_column_count: true, skip_empty_lines: false });
  }
  const path = await newestFile(dir, f.pattern);
  if (!path) throw new Error(`visas: no file like ${f.pattern} in ${dir}. Run without --cached to download it.`);
  const wb = await readXlsx(path);
  return wb.sheet(f.sheet);
}

export async function run(mode) {
  if (mode === 'download') await downloadAll();
  const data = buildVisas(await readGrid(FILES.outcomes, mode), await readGrid(FILES.occupation, mode));

  if (mode !== 'fixture') {
    const ods = await newestFile(inputDir(FILES.summary.source, mode), FILES.summary.pattern);
    if (ods) {
      const published = summaryWork(await (await readOds(ods)).sheet(FILES.summary.sheet), data.years.at(-1).year);
      const ours = data.grants.work.at(-1);
      if (published !== null && published !== ours) console.warn(`visas: work visas, ${data.updated}: Vis_D02 sums to ${ours}, Vis_01 says ${published}`);
    }
  }

  await writeJson(`features/${NAME}.json`, data);
  return `${data.years.length} years to ${data.updated}, ${data.quarters.length} quarters, ${data.occupation.topJobs.length} top jobs (${mode})`;
}
