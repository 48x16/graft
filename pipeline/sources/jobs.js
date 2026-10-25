// Who Works (jobs): builds public/data/features/jobs.json, fifty years of employment,
// unemployment and inactivity rates, the reasons people are inactive, and vacancies by industry.
//
// Publisher: Office for National Statistics.
// - ons-labour: Labour market statistics time series (LMS), lms.csv, the dataset behind the
//   monthly Labour market overview. Series picked by CDID: LF24, MGSX, LF2S, MGSV, LF25, MGWY,
//   MGRZ, LF63, LF65, LF69, LF6B, LF67 (and AP2Y for a cross-check). Labour Force Survey, UK,
//   seasonally adjusted, rolling three-month periods labelled by their middle month.
// - ons-vacancies: VACS02 Vacancies by industry, vacs02<mon><yyyy>.xlsx, sheets `levels`
//   (thousands) and `job openings rate` (%). ONS Vacancy Survey, UK, excludes SIC A, T and 78.
// Licence: Open Government Licence v3.0. Cadence: monthly, with the Labour market overview.
//
// Neither file has suppression markers; blank cells (series not yet started) and `..` (the rate
// sheet's "data unavailable") become null. No total here treats a missing cell as 0.

import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parse } from 'csv-parse/sync';
import { download, fetchText, findLinks } from '../lib/fetch.js';
import { clean, inputDir, num, writeJson } from '../lib/util.js';
import { readWorkbook } from '../lib/xlsx.js';

const NAME = 'jobs';
const LABOUR = 'ons-labour';
const VACS = 'ons-vacancies';
const LMS_URL = 'https://www.ons.gov.uk/file?uri=/employmentandlabourmarket/peopleinwork/employmentandemployeetypes/datasets/labourmarketstatistics/current/lms.csv';
const VACS_PAGE = 'https://www.ons.gov.uk/employmentandlabourmarket/peoplenotinwork/unemployment/datasets/vacanciesbyindustryvacs02';

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** Rolling three-month period from its middle month: { key: "2026-07", label: "June to August 2026" }. */
export function rollingPeriod(year, monthIndex) {
  const from = new Date(Date.UTC(year, monthIndex - 1, 1));
  const to = new Date(Date.UTC(year, monthIndex + 1, 1));
  const [fy, fm, ty, tm] = [from.getUTCFullYear(), from.getUTCMonth(), to.getUTCFullYear(), to.getUTCMonth()];
  const label = fy === ty ? `${MONTH_NAMES[fm]} to ${MONTH_NAMES[tm]} ${ty}` : `${MONTH_NAMES[fm]} ${fy} to ${MONTH_NAMES[tm]} ${ty}`;
  return { key: `${year}-${String(monthIndex + 1).padStart(2, '0')}`, label };
}

// Percent cell → fraction, rounded to kill float noise (75.3 → 0.753).
const fraction = (cell) => {
  const v = num(cell);
  return v === null ? null : Math.round(v * 1000) / 100000;
};
// Thousands cell → people.
const people = (cell) => {
  const v = num(cell);
  return v === null ? null : Math.round(v * 1000);
};

const LFS_SERIES = {
  employmentRate: ['LF24', fraction],
  unemploymentRate: ['MGSX', fraction],
  inactivityRate: ['LF2S', fraction],
  menRate: ['MGSV', fraction],
  womenRate: ['LF25', fraction],
  youthUnemploymentRate: ['MGWY', fraction],
  inEmployment: ['MGRZ', people],
};
const INACTIVE_SERIES = {
  longTermSick: 'LF69',
  student: 'LF63',
  familyHome: 'LF65',
  retired: 'LF6B',
  temporarySick: 'LF67',
};
const FIRST_LFS_KEY = '1971-02';

/**
 * lms.csv as rows of cells (no header parsing) → { updated, lfs, inactive, ap2y }.
 * Only `YYYY MON` rows are used; annual and quarterly rows are ignored. The series run from
 * 1971 FEB to the latest period with an LF24 value.
 */
export function buildLfs(rows) {
  const cdidRow = rows.find((r) => clean(r[0]) === 'CDID');
  if (!cdidRow) throw new Error(`${LABOUR}: lms.csv has no "CDID" row. Has the file changed?`);
  const col = {};
  for (const cdid of [...Object.values(LFS_SERIES).map(([c]) => c), ...Object.values(INACTIVE_SERIES), 'AP2Y']) {
    const i = cdidRow.findIndex((c) => String(c).trim() === cdid);
    if (i === -1) throw new Error(`${LABOUR}: lms.csv has no series with CDID ${cdid}`);
    col[cdid] = i;
  }
  const monthly = rows
    .map((r) => {
      const m = /^(\d{4}) ([A-Z]{3})$/.exec(String(r[0]).trim());
      if (!m || !MONTHS.includes(m[2])) return null;
      return { ...rollingPeriod(Number(m[1]), MONTHS.indexOf(m[2])), row: r };
    })
    .filter(Boolean)
    .sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));

  // AP2Y (vacancies) runs a month ahead of the LFS: keep its latest for the cross-check.
  const ap2yLast = monthly.filter((p) => num(p.row[col.AP2Y]) !== null).at(-1);
  const ap2y = ap2yLast ? { key: ap2yLast.key, value: people(ap2yLast.row[col.AP2Y]) } : null;

  const lastIdx = monthly.findLastIndex((p) => num(p.row[col.LF24]) !== null);
  if (lastIdx === -1) throw new Error(`${LABOUR}: LF24 has no monthly values`);
  const periods = monthly.slice(0, lastIdx + 1).filter((p) => p.key >= FIRST_LFS_KEY);
  if (periods.length === 0) throw new Error(`${LABOUR}: no monthly rows from 1971 FEB`);

  const lfs = { periods: periods.map(({ key, label }) => ({ key, label })) };
  for (const [field, [cdid, conv]] of Object.entries(LFS_SERIES)) lfs[field] = periods.map((p) => conv(p.row[col[cdid]]));
  const inactive = {};
  for (const [field, cdid] of Object.entries(INACTIVE_SERIES)) inactive[field] = periods.map((p) => people(p.row[col[cdid]]));
  return { updated: periods.at(-1).label, lfs, inactive, ap2y };
}

// Clean names from the SIC 2007 section letter (the sheet's own headings are hyphenated and
// carry footnote digits).
export const SIC_NAMES = {
  B: 'Mining and quarrying',
  C: 'Manufacturing',
  D: 'Electricity and gas supply',
  E: 'Water and waste',
  F: 'Construction',
  G: 'Wholesale and retail',
  H: 'Transport and storage',
  I: 'Accommodation and food',
  J: 'Information and communication',
  K: 'Finance and insurance',
  L: 'Real estate',
  M: 'Professional and scientific',
  N: 'Administrative and support',
  O: 'Public administration and defence',
  P: 'Education',
  Q: 'Health and social work',
  R: 'Arts and entertainment',
  S: 'Other services',
};
const SHORT = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 };
const PRE_PANDEMIC_KEY = '2020-01';

/**
 * One VACS02 sheet (rows of cells) → { codes: column index by SIC code, rows: [{ key, label, flag, cells }] }.
 * Data rows start after the code row and stop at the first blank row (summary rows follow it).
 */
export function vacsSheet(rows, what) {
  const codeIdx = rows.findIndex((r) => String(r[2] ?? '').trim() === 'B-S');
  if (codeIdx === -1) throw new Error(`${VACS}: sheet "${what}" has no SIC code row with "B-S". Has the table changed?`);
  const codes = {};
  rows[codeIdx].forEach((c, i) => {
    const s = String(c ?? '').trim();
    if (s) codes[s] = i;
  });
  for (const code of ['B-S', ...Object.keys(SIC_NAMES)]) if (!(code in codes)) throw new Error(`${VACS}: sheet "${what}" has no column for SIC ${code}`);
  const blank = (r) => !r || r.every((c) => String(c ?? '').trim() === '');
  // Labels are tidied first: the sheet has at least one stray space ("Nov- Jan 2002").
  const periodText = (c) => String(c ?? '').trim().replace(/\s*-\s*/, '-').replace(/\s+/g, ' ');
  const start = rows.findIndex((r, i) => i > codeIdx && /^[A-Z][a-z]{2}-[A-Z][a-z]{2} \d{4}$/.test(periodText(r[0])));
  if (start === -1) throw new Error(`${VACS}: sheet "${what}" has no period rows like "Apr-Jun 2001"`);
  const out = [];
  for (let i = start; i < rows.length && !blank(rows[i]); i++) {
    const m = /^([A-Z][a-z]{2})-([A-Z][a-z]{2}) (\d{4})$/.exec(periodText(rows[i][0]));
    if (!m || !(m[1] in SHORT) || !(m[2] in SHORT)) throw new Error(`${VACS}: sheet "${what}" row ${i + 1} has an unexpected period "${rows[i][0]}"`);
    // The year belongs to the last month; the middle month is one before it.
    const last = new Date(Date.UTC(Number(m[3]), SHORT[m[2]], 1));
    const mid = new Date(Date.UTC(last.getUTCFullYear(), last.getUTCMonth() - 1, 1));
    const flag = String(rows[i][1] ?? '').replace(/[()\s]/g, '') || null;
    out.push({ ...rollingPeriod(mid.getUTCFullYear(), mid.getUTCMonth()), flag, cells: rows[i] });
  }
  return { codes, rows: out };
}

/** VACS02 `levels` and `job openings rate` sheets (rows of cells) → the contract's `vacancies`. */
export function buildVacancies(levelRows, rateRows) {
  const levels = vacsSheet(levelRows, 'levels');
  const rates = vacsSheet(rateRows, 'job openings rate');
  const latestRate = rates.rows.at(-1);
  const latest = levels.rows.at(-1);
  if (latestRate.key !== latest.key) console.warn(`${VACS}: job openings rate latest (${latestRate.label}) differs from levels latest (${latest.label})`);
  const series = (code) => levels.rows.map((r) => people(r.cells[levels.codes[code]]));
  const pre = levels.rows.findIndex((r) => r.key === PRE_PANDEMIC_KEY);

  const industries = Object.keys(SIC_NAMES)
    .sort((a, b) => levels.codes[a] - levels.codes[b])
    .map((code) => {
      const values = series(code);
      let peakAt = -1;
      // Peak = first period reaching the series maximum.
      values.forEach((v, i) => {
        if (v !== null && (peakAt === -1 || v > values[peakAt])) peakAt = i;
      });
      return {
        code,
        name: SIC_NAMES[code],
        latest: values.at(-1),
        prePandemic: pre === -1 ? null : values[pre],
        peak: peakAt === -1 ? null : values[peakAt],
        peakLabel: peakAt === -1 ? null : levels.rows[peakAt].label,
        openingsRate: fraction(latestRate.cells[rates.codes[code]]),
      };
    });

  return {
    updated: latest.label,
    periods: levels.rows.map(({ key, label, flag }) => ({ key, label, flag })),
    total: series('B-S'),
    industries,
    openingsRateAll: fraction(latestRate.cells[rates.codes['B-S']]),
  };
}

/** Both parts → jobs.json, in the contract's order. Warns if VACS02 and lms.csv AP2Y disagree. */
export function buildJobs(lmsRows, levelRows, rateRows, warn = console.warn) {
  const { updated, lfs, inactive, ap2y } = buildLfs(lmsRows);
  const vacancies = buildVacancies(levelRows, rateRows);
  const last = vacancies.periods.at(-1);
  if (!ap2y) warn(`${NAME}: lms.csv has no AP2Y values to cross-check vacancies`);
  else if (ap2y.key !== last.key || ap2y.value !== vacancies.total.at(-1))
    warn(`${NAME}: vacancies cross-check: VACS02 ${last.key} = ${vacancies.total.at(-1)}, lms.csv AP2Y ${ap2y.key} = ${ap2y.value}`);
  return { updated, lfs, inactive, vacancies };
}

const csvRows = (text) => parse(text, { relax_column_count: true, bom: true });

/** The newest vacs02<mon><yyyy>.xlsx in a folder. */
async function latestVacsFile(dir) {
  const files = (await readdir(dir)).filter((f) => /^vacs02[a-z]{3}\d{4}\.xlsx$/i.test(f));
  if (files.length === 0) throw new Error(`${VACS}: no vacs02<mon><yyyy>.xlsx in ${dir}`);
  const when = (f) => {
    const m = /^vacs02([a-z]{3})(\d{4})/i.exec(f);
    return Number(m[2]) * 12 + MONTHS.indexOf(m[1].toUpperCase());
  };
  return join(dir, files.sort((a, b) => when(a) - when(b)).at(-1));
}

export async function run(mode) {
  if (mode === 'download') {
    await download(LMS_URL, join(inputDir(LABOUR, mode), 'lms.csv'));
    const html = await fetchText(VACS_PAGE);
    const links = findLinks(html, VACS_PAGE, /\/current\/vacs02[a-z]{3}\d{4}\.xlsx$/i);
    if (links.length !== 1) throw new Error(`${VACS}: expected one current vacs02 xlsx link on ${VACS_PAGE}, found ${links.length}`);
    const fileName = /vacs02[a-z]{3}\d{4}\.xlsx$/i.exec(links[0])[0].toLowerCase();
    await download(links[0], join(inputDir(VACS, mode), fileName));
  }

  const lmsRows = csvRows(await readFile(join(inputDir(LABOUR, mode), 'lms.csv'), 'utf8'));
  let levelRows;
  let rateRows;
  if (mode === 'fixture') {
    // The fixture keeps each sheet as a CSV named after it.
    const dir = inputDir(VACS, mode);
    levelRows = csvRows(await readFile(join(dir, 'levels.csv'), 'utf8'));
    rateRows = csvRows(await readFile(join(dir, 'job openings rate.csv'), 'utf8'));
  } else {
    const wb = await readWorkbook(await latestVacsFile(inputDir(VACS, mode)));
    for (const s of ['levels', 'job openings rate']) if (!wb.names.includes(s)) throw new Error(`${VACS}: workbook has no sheet "${s}" (has ${wb.names.join(', ')})`);
    levelRows = await wb.sheet('levels');
    rateRows = await wb.sheet('job openings rate');
  }

  const data = buildJobs(lmsRows, levelRows, rateRows);
  await writeJson(`features/${NAME}.json`, data);
  return `${data.lfs.periods.length} LFS periods to ${data.updated}; ${data.vacancies.periods.length} vacancy periods to ${data.vacancies.updated} (${mode})`;
}
