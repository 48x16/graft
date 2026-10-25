import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parse } from 'csv-parse/sync';
import { beforeAll, describe, expect, it } from 'vitest';
import { buildAshe, buildPay, buildRti, monthKey, readAsheSheet } from '../pipeline/sources/pay.js';
import { ROOT } from '../pipeline/lib/util.js';

const DIR = join(ROOT, 'test', 'fixtures', 'ons-pay');
const csv = async (path) => parse(await readFile(path, 'utf8'), { relax_column_count: true });

let sheets;
let rtiSheets;
let data;
beforeAll(async () => {
  const folders = await readdir(join(DIR, 'ashe3'));
  const sheet = (t) => csv(join(DIR, 'ashe3', folders.find((f) => f.includes(`Table ${t} `)), 'Full-Time.csv'));
  sheets = { weekly: await sheet('3.1a'), hourly: await sheet('3.5a'), annual: await sheet('3.7a') };
  const rti = (s) => csv(join(DIR, 'rtisaoct2026', `${s}.csv`));
  rtiSheets = {
    payrolled: await rti('1. Payrolled employees (UK)'),
    median: await rti('2. Median pay (UK)'),
    regions: await rti('8. Median pay (NUTS1)'),
    industries: await rti('24. Median pay (Industry)'),
  };
  data = buildPay(buildAshe(sheets, true), buildRti(rtiSheets));
});

describe('pay: ASHE', () => {
  it('reads the UK full-time headline figures', () => {
    expect(data.ashe).toMatchObject({ year: 2026, provisional: true, ukFullTimeWeekly: 811.2, ukFullTimeWeeklyChange: 0.058, ukFullTimeAnnual: 40911.2 });
  });

  it('has the 12 regions, largest median first, with trailing-space codes stripped', () => {
    const r = data.ashe.regions;
    expect(r).toHaveLength(12);
    expect(r[0]).toEqual({ code: 'E12000007', name: 'London', weekly: 1038.1, weeklyChange: 0.082, hourly: 27.77 });
    expect(r.at(-1).name).toBe('North East');
    expect(r.map((x) => x.code)).toContain('S92000003');
    for (let i = 1; i < r.length; i++) expect(r[i].weekly).toBeLessThanOrEqual(r[i - 1].weekly);
  });

  it('keeps a missing annual change as null, not 0', () => {
    expect(data.ashe.regions.find((x) => x.code === 'E12000001').weeklyChange).toBeNull();
  });

  it('has the 26 UK two-digit groups only (no one-digit or regional rows), nulls last', () => {
    const o = data.ashe.occupations;
    expect(o).toHaveLength(26);
    expect(o.every((x) => /^\d{2}$/.test(x.code) && x.major === x.code[0])).toBe(true);
    expect(o[0]).toEqual({ code: '11', name: 'Corporate managers and directors', major: '1', weekly: 1329.8, hourly: 34.87 });
    // London's corporate managers (£1,820.7) must not replace the UK figure.
    expect(o.find((x) => x.code === '11').weekly).toBe(1329.8);
    const sup = o.at(-1);
    expect(sup).toMatchObject({ code: '33', weekly: null, hourly: null });
    const ranked = o.filter((x) => x.weekly !== null);
    expect(ranked.at(-1)).toMatchObject({ code: '71', name: 'Sales occupations', weekly: 558.5 });
    expect(o.find((x) => x.code === '61').weekly).toBe(586.9);
  });

  it('fails loudly when a region is missing or the header changes', () => {
    const noLondon = sheets.weekly.filter((r) => !String(r[1]).includes('E12000007'));
    expect(() => readAsheSheet(noLondon, 'test')).toThrow(/missing region rows E12000007/);
    const badHeader = sheets.weekly.map((r) => (r[0] === 'Description' ? ['Desc', ...r.slice(1)] : r));
    expect(() => readAsheSheet(badHeader, 'test')).toThrow(/no header row/);
  });
});

describe('pay: RTI', () => {
  it('parses month labels', () => {
    expect(monthKey('September 2026')).toBe('2026-09');
    expect(monthKey('Sept 2026')).toBeNull();
  });

  it('keeps months, payrolled and median pay aligned, oldest first, with the gap left as a gap', () => {
    const r = data.rti;
    expect(r.months[0]).toEqual({ key: '2020-01', label: 'January 2020' });
    expect(r.months.map((m) => m.key)).toContain('2020-02');
    expect(r.months.map((m) => m.key)).not.toContain('2021-01');
    expect(r.payrolled).toHaveLength(r.months.length);
    expect(r.medianMonthly).toHaveLength(r.months.length);
    expect(r.flashLabel).toBe('September 2026');
    expect(r.payrolled.at(-1)).toBe(30280860);
    expect(r.medianMonthly.at(-1)).toBe(2660);
    // Bulletin: payrolled employees fell by 111,000 from August 2025 to August 2026.
    const at = (k) => r.payrolled[r.months.findIndex((m) => m.key === k)];
    expect(at('2026-08') - at('2025-08')).toBe(-111260);
  });

  it('has 12 regions (no UK column) and 20 industries, largest first', () => {
    const { regions, industries } = data.rti;
    expect(regions).toHaveLength(12);
    expect(regions.some((x) => x.name === 'UK')).toBe(false);
    expect(regions[0]).toEqual({ code: 'UKI', name: 'London', medianMonthly: 3119 });
    expect(industries).toHaveLength(20);
    expect(industries.map((x) => x.code)).toContain('A');
    expect(industries.find((x) => x.code === 'I')).toEqual({ code: 'I', name: 'Accommodation and food service activities', medianMonthly: 1444 });
    for (let i = 1; i < industries.length; i++) expect(industries[i].medianMonthly).toBeLessThanOrEqual(industries[i - 1].medianMonthly);
  });
});

describe('pay: contract', () => {
  it('has exactly the contract fields, in order', () => {
    expect(Object.keys(data)).toEqual(['updated', 'ashe', 'rti']);
    expect(Object.keys(data.ashe)).toEqual(['year', 'provisional', 'ukFullTimeWeekly', 'ukFullTimeWeeklyChange', 'ukFullTimeAnnual', 'regions', 'occupations']);
    expect(Object.keys(data.rti)).toEqual(['months', 'payrolled', 'medianMonthly', 'flashLabel', 'regions', 'industries']);
    expect(data.updated).toBe('April 2026 (ASHE, provisional); September 2026 (PAYE)');
  });

  it('carries no job counts (ASHE job numbers are indicative only)', () => {
    expect(JSON.stringify(data)).not.toMatch(/jobs|thousand/i);
  });
});
