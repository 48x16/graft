import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ROOT } from '../pipeline/lib/util.js';
import { readWorkbook } from '../pipeline/lib/xls.js';
import { buildBornAbroad, caution, currentFile, parseQuarter, pickFile, quarterLabel } from '../pipeline/sources/born-abroad.js';

const FIXTURE = join(ROOT, 'test', 'fixtures', 'ons-birth', 'emp06aug2026.xls');

async function fixtureSheets() {
  const book = await readWorkbook(FIXTURE);
  return {
    levels: await book.sheet('Country of birth levels'),
    rates: await book.sheet('Country of birth rates'),
    nationality: await book.sheet('Nationality Levels'),
  };
}

describe('born-abroad helpers', () => {
  it('parses quarter labels with footnote digits glued to the year', () => {
    expect(parseQuarter('Jan-Mar 20197')).toEqual({ quarter: 'Jan-Mar', year: 2019 });
    expect(parseQuarter('Apr-Jun 20208')).toEqual({ quarter: 'Apr-Jun', year: 2020 });
    expect(parseQuarter('1. The total series includes…')).toBeNull();
    expect(parseQuarter('Dataset identifier code')).toBeNull();
    expect(() => parseQuarter('Feb-Apr 2026')).toThrow(/not a calendar quarter/);
    expect(quarterLabel('Apr-Jun')).toBe('April to June');
  });

  it('flags the reweighting year and the pandemic years', () => {
    expect([2018, 2019, 2020, 2021, 2022, 2023].map(caution)).toEqual(['none', 'reweight', 'pandemic', 'pandemic', 'pandemic', 'none']);
  });

  it('finds the current file behind ONS /file?uri= links, ignoring previous versions', () => {
    const base = 'https://www.ons.gov.uk/x/datasets/emp06';
    const html = `<a href="/file?uri=/x/datasets/emp06/current/emp06aug2026.xls">xls</a>
      <a href="/file?uri=/x/datasets/emp06/previous/v40/emp06may2026.xls">old</a>`;
    expect(currentFile(html, base)).toEqual({ url: 'https://www.ons.gov.uk/file?uri=/x/datasets/emp06/current/emp06aug2026.xls', name: 'emp06aug2026.xls' });
    expect(() => currentFile('<a href="/elsewhere.xls">x</a>', base)).toThrow(/found none/);
  });

  it('picks the newest edition in a folder', () => {
    expect(pickFile(['emp06may2026.xls', 'emp06aug2026.xls', 'emp06nov2025.xls', 'notes.txt'])).toBe('emp06aug2026.xls');
    expect(pickFile(['other.xls'])).toBeNull();
  });
});

describe('buildBornAbroad on the fixture', () => {
  it('follows the latest quarter, once a year, skipping years without it', async () => {
    const d = buildBornAbroad(await fixtureSheets());
    expect(Object.keys(d)).toEqual(['updated', 'quarter', 'quarterLabel', 'years', 'caution', 'levels', 'rates', 'nationality']);
    expect(d.updated).toBe('April to June 2026');
    expect(d.quarter).toBe('Apr-Jun');
    expect(d.quarterLabel).toBe('April to June');
    expect(d.years).toEqual([1997, 2008, 2016, 2019, 2020, 2024, 2026]); // no 2010: only Jul-Sep that year
    expect(d.caution).toEqual(['none', 'none', 'none', 'reweight', 'pandemic', 'none', 'none']);
    for (const group of ['levels', 'rates', 'nationality']) for (const s of Object.values(d[group])) expect(s).toHaveLength(d.years.length);
  });

  it('keeps real figures: whole people for levels, fractions for rates', async () => {
    const d = buildBornAbroad(await fixtureSheets());
    expect(Object.keys(d.levels)).toEqual(['total', 'ukBorn', 'nonUkBorn', 'euBorn', 'nonEuBorn']);
    expect(Object.keys(d.rates)).toEqual(['total', 'ukBorn', 'nonUkBorn', 'euBorn', 'nonEuBorn']);
    expect(Object.keys(d.nationality)).toEqual(['uk', 'nonUk']);
    expect(d.levels.total.at(-1)).toBe(34426383); // ONS headline: MGTM Apr-Jun 2026
    expect(d.levels.nonUkBorn.at(-1)).toBe(7662069);
    expect(d.levels.nonUkBorn[0]).toBe(1975138);
    expect(d.rates.total.at(-1)).toBeCloseTo(0.749843, 6); // 75.0%, read from a FORMULA cell
    expect(d.rates.nonUkBorn[0]).toBeCloseTo(0.618596, 6);
    expect(d.nationality.nonUk.at(-1)).toBe(5026556);
    // The total includes people who did not state a country of birth.
    expect(d.levels.total.at(-1)).toBeGreaterThan(d.levels.ukBorn.at(-1) + d.levels.nonUkBorn.at(-1));
  });

  it('turns "*" and ".." into null, never 0', async () => {
    const d = buildBornAbroad(await fixtureSheets());
    const at = (y) => d.years.indexOf(y);
    expect(d.levels.nonUkBorn[at(2020)]).toBeNull(); // ".."
    expect(d.rates.euBorn[at(1997)]).toBeNull(); // "*"
    expect(JSON.stringify(d)).not.toMatch(/(^|[^.\d])0(,|\])/); // no stray zeros
  });

  it('reads Total EU from column D only, ignoring the duplicate in column G', async () => {
    const d = buildBornAbroad(await fixtureSheets());
    expect(d.levels.euBorn[d.years.indexOf(2024)]).toBe(2237380); // column G is ".." in the fixture
    expect(d.levels.euBorn[d.years.indexOf(2016)]).toBe(2334727); // not doubled
  });

  it('fails loudly when a CDID, a header row or a sheet goes missing', async () => {
    const sheets = await fixtureSheets();
    const renamed = sheets.levels.map((r) => r.map((c) => (c === 'JF6G' ? 'XXXX' : c)));
    expect(() => buildBornAbroad({ ...sheets, levels: renamed })).toThrow(/missing CDID JF6G/);
    const noCodes = sheets.rates.filter((r) => r[0] !== 'Dataset identifier code');
    expect(() => buildBornAbroad({ ...sheets, rates: noCodes })).toThrow(/no "Dataset identifier code" row/);
    expect(() => buildBornAbroad({ ...sheets, nationality: sheets.rates })).toThrow(/title/);
    expect(() => buildBornAbroad({ levels: sheets.levels, rates: sheets.rates })).toThrow(/Nationality Levels/);
  });

  it('carries no deaths, casualties or arrivals fields', async () => {
    const text = JSON.stringify(buildBornAbroad(await fixtureSheets()));
    expect(text).not.toMatch(/death|casualt|arriv|flow/i);
  });
});
