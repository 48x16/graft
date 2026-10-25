import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'csv-parse/sync';
import { describe, expect, it } from 'vitest';
import { buildAsylum, buildAwaiting, buildClaimsAndDecisions, buildSupport, crossCheck, parseAsAt } from '../pipeline/sources/asylum.js';
import { rowsUnder } from '../pipeline/lib/util.js';

const dir = join(import.meta.dirname, 'fixtures', 'ho-asylum');
const grid = (sheet) => parse(readFileSync(join(dir, `asylum-${sheet}.csv`), 'utf8'), { relax_column_count: true, skip_empty_lines: true, bom: true });
const rows = (sheet, first) => rowsUnder(grid(sheet), first, sheet);
const input = () => ({
  d01: rows('Data_Asy_D01', 'Year'),
  d02: rows('Data_Asy_D02', 'Year'),
  d03: rows('Data_Asy_D03', 'Date (as at...)'),
  d09: rows('Data_Asy_D09', 'Date (as at…)'),
});

describe('buildAsylum', () => {
  const d = buildAsylum(input());

  it('has exactly the contract fields, in order', () => {
    expect(Object.keys(d)).toEqual(['updated', 'years', 'claims', 'decisions', 'decisionsPeople', 'awaiting', 'nationalities', 'support']);
    expect(Object.keys(d.decisions)).toEqual(['protection', 'otherLeave', 'refused', 'withdrawn', 'grantRate']);
    expect(Object.keys(d.awaiting.byDuration)).toEqual(['under3m', '3to6m', '6to12m', '12mPlus']);
    expect(JSON.stringify(d)).not.toMatch(/deceased|death/i);
  });

  it('builds years ending June, marking the latest calendar year provisional', () => {
    expect(d.years).toEqual([
      { year: 2002, label: 'year ending June 2002', provisional: false },
      { year: 2003, label: 'year ending June 2003', provisional: false },
      { year: 2004, label: 'year ending June 2004', provisional: true },
    ]);
    expect(d.updated).toBe('year ending June 2004');
  });

  it('sums claims, with people null where dependants were not recorded and a missing quarter null', () => {
    // YE June 2002: 2001 Q3 and Q4 have main applicants only.
    expect(d.claims.mainApplicants[0]).toBe(390);
    expect(d.claims.people[0]).toBeNull();
    // YE June 2003 lacks 2003 Q1: null, never a part-year total.
    expect(d.claims.people[1]).toBeNull();
    expect(d.claims.mainApplicants[1]).toBeNull();
    // YE June 2004: both spellings of unknown age counted once each.
    expect(d.claims.mainApplicants[2]).toBe(630);
    expect(d.claims.people[2]).toBe(647);
  });

  it('counts decisions on main applicants, drops Admin - Deceased, and computes the grant rate', () => {
    expect(d.decisions.protection).toEqual([20, null, 50]);
    expect(d.decisions.otherLeave).toEqual([10, null, 0]);
    expect(d.decisions.refused).toEqual([100, null, 60]);
    expect(d.decisions.withdrawn).toEqual([5, null, 2]);
    expect(d.decisions.grantRate[0]).toBeCloseTo(30 / 130);
    expect(d.decisions.grantRate[1]).toBeNull();
    expect(d.decisions.grantRate[2]).toBeCloseTo(50 / 110);
    // All applicant types and outcome groups except the 3 Admin - Deceased.
    expect(d.decisionsPeople).toEqual([135, null, 123]);
  });

  it('ranks the top ten nationalities by claims, excluding the residual, with rates only on 50+ decisions', () => {
    expect(d.nationalities.map((n) => n.name)).toEqual(['Pakistan', 'Eritrea', 'Albania', 'Iraq', 'Iran', 'Sudan', 'Syria', 'Yemen', 'Vietnam', 'India']);
    expect(d.nationalities[0]).toEqual({ name: 'Pakistan', claims: 70, decisions: 80, grantRate: 0.25 });
    // Eritrea: 30 decisions, under the base of 50, so no rate.
    expect(d.nationalities[1]).toEqual({ name: 'Eritrea', claims: 32, decisions: 30, grantRate: null });
    expect(d.nationalities.find((n) => n.name === 'Albania')).toEqual({ name: 'Albania', claims: 9, decisions: 0, grantRate: null });
    expect(d.nationalities.some((n) => /other|unknown/i.test(n.name))).toBe(false);
  });

  it('counts the queue awaiting an initial decision only', () => {
    expect(d.awaiting.dates).toEqual([
      { key: '2010-06-30', label: '30 June 2010' },
      { key: '2010-09-30', label: '30 September 2010' },
    ]);
    expect(d.awaiting.people).toEqual([14, 25]); // the 100 pending further review left out
    expect(d.awaiting.cases).toEqual([10, 25]);
    expect(d.awaiting.byDuration).toEqual({ under3m: [10, 0], '3to6m': [0, 5], '6to12m': [4, 0], '12mPlus': [0, 20] });
  });

  it('counts people on support, with hotels null before they were recorded and 0 after', () => {
    expect(d.support.dates.map((x) => x.key)).toEqual(['2014-03-31', '2022-12-31', '2023-03-31']);
    expect(d.support.people).toEqual([105, 100, 70]);
    expect(d.support.hotels).toEqual([null, 40, 0]);
  });

  it('agrees with the fixture Asy_00a, and reports a mismatch', () => {
    expect(crossCheck(d, grid('Asy_00a'))).toEqual([]);
    const wrong = structuredClone(d);
    wrong.claims.people[2] = 1;
    expect(crossCheck(wrong, grid('Asy_00a'))).toEqual(['People claiming asylum: ours 1, Asy_00a 647']);
  });
});

describe('editorial rules and validation', () => {
  it('turns a blank count into null, never 0', () => {
    const { d01, d02 } = input();
    d01.find((r) => r.Quarter === '2004 Q2').Claims = '';
    const out = buildClaimsAndDecisions(d01, d02);
    expect(out.claims.people[2]).toBeNull();
    expect(out.claims.mainApplicants[2]).toBeNull();
    expect(out.claims.people[0]).toBeNull(); // unchanged reason
    expect(out.claims.mainApplicants[0]).toBe(390);

    const d03 = input().d03;
    d03[0].Claims = '[c]';
    expect(buildAwaiting(d03).people).toEqual([null, 25]);
  });

  it('fails loudly on changed tables', () => {
    const { d01, d02, d03, d09 } = input();
    expect(() => buildClaimsAndDecisions(d01.map(({ Claims, ...r }) => r), d02)).toThrow(/missing column "Claims"/);
    expect(() => buildClaimsAndDecisions(d01, d02.map((r) => ({ ...r, 'Case outcome group': 'Granted' })))).toThrow(/unexpected Case outcome group/);
    expect(() => buildAwaiting(d03.map((r) => ({ ...r, 'Application stage': 'Pending' })))).toThrow(/unexpected Application stage/);
    expect(() => buildSupport(d09.filter((r) => !r['Accommodation Type'].includes('Hotel')))).toThrow(/Hotel/);
    expect(() => parseAsAt('2026-06-30')).toThrow(/not like/);
  });
});
