import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'csv-parse/sync';
import { describe, expect, it, vi } from 'vitest';
import { buildJobs, buildLfs, buildVacancies, rollingPeriod } from '../pipeline/sources/jobs.js';
import { ROOT } from '../pipeline/lib/util.js';

const fx = (...p) => parse(readFileSync(join(ROOT, 'test', 'fixtures', ...p), 'utf8'), { relax_column_count: true, bom: true });
const lms = fx('ons-labour', 'lms.csv');
const levels = fx('ons-vacancies', 'levels.csv');
const rates = fx('ons-vacancies', 'job openings rate.csv');

describe('rollingPeriod', () => {
  it('labels a period by the months either side of its middle month', () => {
    expect(rollingPeriod(2026, 6)).toEqual({ key: '2026-07', label: 'June to August 2026' });
    expect(rollingPeriod(1971, 1)).toEqual({ key: '1971-02', label: 'January to March 1971' });
    expect(rollingPeriod(2020, 0)).toEqual({ key: '2020-01', label: 'December 2019 to February 2020' });
  });
});

describe('buildLfs', () => {
  const { updated, lfs, inactive, ap2y } = buildLfs(lms);

  it('uses monthly rows only, from 1971 FEB to the latest LF24 period, oldest first', () => {
    const keys = lfs.periods.map((p) => p.key);
    expect(keys[0]).toBe('1971-02');
    expect(keys.at(-1)).toBe('2026-07');
    expect(keys).not.toContain('1970-12'); // before the series start
    expect(keys).not.toContain('2026-08'); // AP2Y only, no LFS yet
    expect(keys.length).toBe(10);
    expect(updated).toBe('June to August 2026');
  });

  it('stores rates as fractions and counts as people', () => {
    expect(lfs.employmentRate.at(-1)).toBe(0.753);
    expect(lfs.unemploymentRate.at(-1)).toBe(0.047);
    expect(lfs.inactivityRate.at(-1)).toBe(0.209);
    expect(lfs.menRate[0]).toBe(0.921);
    expect(lfs.womenRate[0]).toBe(0.528);
    expect(lfs.inEmployment.at(-1)).toBe(34577000);
    expect(inactive.longTermSick.at(-1)).toBe(2738000);
  });

  it('keeps blanks as null, never 0, and aligns every series to the periods', () => {
    const n = lfs.periods.length;
    for (const s of [...Object.values(lfs).slice(1), ...Object.values(inactive)]) expect(s).toHaveLength(n);
    const i1992 = lfs.periods.findIndex((p) => p.key === '1992-04');
    expect(lfs.youthUnemploymentRate.slice(0, i1992).every((v) => v === null)).toBe(true);
    expect(lfs.youthUnemploymentRate[i1992]).toBe(0.161);
    const i1993 = lfs.periods.findIndex((p) => p.key === '1993-04');
    expect(inactive.student.slice(0, i1993).every((v) => v === null)).toBe(true);
    const iJun = lfs.periods.findIndex((p) => p.key === '2026-06');
    expect(inactive.temporarySick[iJun]).toBeNull(); // blanked in the fixture
  });

  it('keeps the AP2Y latest for the cross-check', () => {
    expect(ap2y).toEqual({ key: '2026-08', value: 691000 });
  });

  it('throws when a series is missing', () => {
    const broken = lms.map((r) => r.map((c) => (c === 'LF69' ? 'XXXX' : c)));
    expect(() => buildLfs(broken)).toThrow(/LF69/);
  });
});

describe('buildVacancies', () => {
  const v = buildVacancies(levels, rates);

  it('reads the period rows only, stopping at the summary rows', () => {
    expect(v.periods).toHaveLength(8);
    expect(v.periods[0]).toEqual({ key: '2001-05', label: 'April to June 2001', flag: null });
    expect(v.periods[1].key).toBe('2020-01');
    expect(v.periods.at(-1)).toEqual({ key: '2026-08', label: 'July to September 2026', flag: 'p' });
    expect(v.periods.at(-2).flag).toBe('r');
    expect(v.updated).toBe('July to September 2026');
    expect(v.total.at(-1)).toBe(691000);
    expect(v.total).not.toContain(-21000);
  });

  it('has the 18 sections B to S only, in sheet order, with clean names', () => {
    expect(v.industries.map((i) => i.code).join('')).toBe('BCDEFGHIJKLMNOPQRS');
    expect(v.industries.map((i) => i.code)).not.toContain('G-S');
    const q = v.industries.find((i) => i.code === 'Q');
    expect(q).toEqual({ code: 'Q', name: 'Health and social work', latest: 122000, prePandemic: 137000, peak: 216000, peakLabel: 'May to July 2022', openingsRate: 0.026 });
    expect(v.industries.every((i) => !/\d|-\s/.test(i.name))).toBe(true);
  });

  it("takes each industry's own peak, and keeps tiny sections as they are", () => {
    const i = v.industries.find((x) => x.code === 'I');
    expect([i.peak, i.peakLabel]).toEqual([177000, 'April to June 2022']);
    const b = v.industries.find((x) => x.code === 'B');
    expect([b.latest, b.prePandemic, b.peak]).toEqual([2000, 1000, 2000]);
    expect(b.peakLabel).toBe('April to June 2001'); // first period at the maximum
  });

  it('turns ".." in the rate sheet into null and rates into fractions', () => {
    expect(v.industries.find((x) => x.code === 'S').openingsRate).toBeNull();
    expect(v.industries.find((x) => x.code === 'B').openingsRate).toBe(0.033);
    expect(v.openingsRateAll).toBe(0.021);
  });

  it('throws when a section column is missing', () => {
    const broken = levels.map((r) => r.map((c) => (c === 'Q' ? 'Z' : c)));
    expect(() => buildVacancies(broken, rates)).toThrow(/SIC Q/);
  });
});

describe('buildJobs', () => {
  it('outputs exactly the contract fields, in order, and nothing else', () => {
    const warn = vi.fn();
    const data = buildJobs(lms, levels, rates, warn);
    expect(Object.keys(data)).toEqual(['updated', 'lfs', 'inactive', 'vacancies']);
    expect(Object.keys(data.lfs)).toEqual(['periods', 'employmentRate', 'unemploymentRate', 'inactivityRate', 'menRate', 'womenRate', 'youthUnemploymentRate', 'inEmployment']);
    expect(Object.keys(data.inactive)).toEqual(['longTermSick', 'student', 'familyHome', 'retired', 'temporarySick']);
    expect(Object.keys(data.vacancies)).toEqual(['updated', 'periods', 'total', 'industries', 'openingsRateAll']);
    expect(warn).not.toHaveBeenCalled(); // VACS02 691 matches AP2Y 2026 AUG
  });

  it('warns when VACS02 and lms.csv disagree', () => {
    const warn = vi.fn();
    const changed = lms.map((r) => (r[0] === '2026 AUG' ? r.map((c, i) => (i === r.length - 1 ? '700' : c)) : r));
    buildJobs(changed, levels, rates, warn);
    expect(warn).toHaveBeenCalledWith(expect.stringMatching(/cross-check/));
  });
});
