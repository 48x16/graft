import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'csv-parse/sync';
import { describe, expect, it } from 'vitest';
import { buildOccupation, buildVisaOutcomes, buildVisas, quarterIndex, routeName, splitLabel, yearsEndingJune } from '../pipeline/sources/visas.js';

const grid = (source, sheet) => parse(readFileSync(join(import.meta.dirname, 'fixtures', source, `${sheet}.csv`), 'utf8'), { relax_column_count: true });
const vis = grid('ho-visas', 'Data_Vis_D02');
const occ = grid('ho-work-occupation', 'Data_Occ_D02');
const d = buildVisas(vis, occ);

describe('periods', () => {
  it('builds years ending June only where all four quarters can exist', () => {
    // 2023 Q3 to 2026 Q2 → YE 2024, 2025, 2026; 2021 Q1 start → first full YE is 2022
    expect(yearsEndingJune(quarterIndex('2023 Q3'), quarterIndex('2026 Q2'))).toEqual([2024, 2025, 2026]);
    expect(yearsEndingJune(quarterIndex('2021 Q1'), quarterIndex('2026 Q2'))).toEqual([2022, 2023, 2024, 2025, 2026]);
    expect(yearsEndingJune(quarterIndex('2025 Q3'), quarterIndex('2026 Q3'))).toEqual([2026]);
  });

  it('fails loudly on a quarter it cannot read', () => {
    expect(() => quarterIndex('2026-Q2')).toThrow(/quarter/);
  });
});

describe('buildVisaOutcomes', () => {
  it('labels years and marks the latest two quarters provisional', () => {
    expect(d.updated).toBe('year ending June 2026');
    expect(d.years).toEqual([
      { year: 2024, label: 'year ending June 2024', provisional: false },
      { year: 2025, label: 'year ending June 2025', provisional: false },
      { year: 2026, label: 'year ending June 2026', provisional: true },
    ]);
    expect(d.quarters.at(-1)).toEqual({ key: '2026 Q2', label: 'April to June 2026', provisional: true });
    expect(d.quarters.at(-3).provisional).toBe(false);
  });

  it('sums issued visas by group over years ending June', () => {
    expect(d.grants.work).toEqual([3600, null, 2620]);
    expect(d.grants.study).toEqual([2040, null, 2040]);
    expect(d.grants.visitor).toEqual([8004, null, 8004]); // includes the one Iceland visa
    expect(d.grants.total).toEqual([14164, null, 13184]);
    expect(d.work).toEqual({ main: [3000, null, 2020], dependant: [600, null, 600] });
  });

  it('gives null, not 0, for a year with a quarter missing', () => {
    for (const k of Object.keys(d.grants)) expect(d.grants[k][1]).toBeNull();
    expect(d.routes.healthCareMain[d.quarters.findIndex((q) => q.key === '2024 Q4')]).toBeNull();
  });

  it('computes grant rates as issued / (issued + refused), ignoring withdrawn', () => {
    expect(d.grantRate.family).toBeCloseTo(0.9, 10);
    expect(d.grantRate.visitor).toBeCloseTo(8004 / 10004, 10);
    expect(d.grantRate.work).toBeCloseTo(2620 / 2700, 10);
    // refused a quarter: 20 + 25 + 10 + 500 + 0 = 555, so 2,220 a year
    expect(d.grantRate.all).toBeCloseTo(13184 / (13184 + 2220), 10);
  });

  it('gives quarterly route series aligned to quarters, and the latest YE split', () => {
    for (const s of Object.values(d.routes)) expect(s).toHaveLength(d.quarters.length);
    expect(d.routes.healthCareMain[0]).toBe(400);
    expect(d.routes.healthCareMain.at(-1)).toBe(2);
    expect(d.routeShares).toEqual({ healthCare: { main: 20, dependant: 200 }, skilled: { main: 800, dependant: 400 } });
  });

  it('nulls a work year that has unsplit "All" rows', () => {
    const extra = vis.concat([['2026', '2026 Q1', 'India', 'Asia South', 'Work', 'Worker', 'Skilled Worker', 'All', 'Issued', '5']]);
    const v = buildVisaOutcomes(extra);
    expect(v.work.main.at(-1)).toBeNull();
    expect(v.work.dependant.at(-1)).toBeNull();
    expect(v.grants.work.at(-1)).toBe(2625);
  });

  it('fails loudly when a column or a visa group changes', () => {
    const noOutcome = vis.map((r) => r.slice(0, 8));
    expect(() => buildVisaOutcomes(noOutcome)).toThrow(/missing column/);
    const renamed = vis.map((r, i) => (i > 3 && r[4] === 'Other' ? [...r.slice(0, 4), 'Humanitarian', ...r.slice(5)] : r));
    expect(() => buildVisaOutcomes(renamed)).toThrow(/unknown Visa type group "Humanitarian"/);
  });

  it('carries no fields beyond the contract', () => {
    expect(Object.keys(d)).toEqual(['updated', 'years', 'grants', 'work', 'grantRate', 'quarters', 'routes', 'routeShares', 'occupation']);
    expect(JSON.stringify(d)).not.toMatch(/death|nationality/i);
  });
});

describe('buildOccupation', () => {
  const o = buildOccupation(occ);

  it('splits hierarchy labels and renames the seasonal route', () => {
    expect(splitLabel('613 - Caring Personal Services')).toEqual({ code: '613', name: 'Caring Personal Services' });
    expect(splitLabel('*')).toBeNull();
    expect(routeName('Seasonal Worker (previously Tier 5)')).toBe('Seasonal Worker');
  });

  it('splits Health and Care Worker grants by minor group, including modelled quarters', () => {
    expect(o.years.map((y) => y.year)).toEqual([2025, 2026]);
    expect(o.healthCareByGroup).toEqual({ care: [670, 20], nurses: [80, 80], doctors: [120, 120], other: [12, 12] });
  });

  it('ranks unit groups for Skilled Worker and Health and Care Worker only, without "*"', () => {
    expect(o.topJobs[0]).toEqual({ code: '2134', name: 'Programmers and software development professionals', grants: 160 }); // not the 60 ICT grants
    expect(o.topJobs.map((j) => j.code)).not.toContain('*');
    expect(o.topJobs.map((j) => j.code)).not.toContain('9111'); // seasonal
    // the "*" cell in 2026 Q2 adds nothing: 3 quarters of 5
    expect(o.topJobs.find((j) => j.code === '2421').grants).toBe(15);
    for (let i = 1; i < o.topJobs.length; i++) expect(o.topJobs[i].grants).toBeLessThanOrEqual(o.topJobs[i - 1].grants);
  });

  it('lists sponsored routes largest first, other last, with their total', () => {
    expect(o.sponsoredRoutes.map((r) => r.route)).toEqual(['Seasonal Worker', 'Health and Care Worker', 'Skilled Worker', 'Other sponsored routes']);
    expect(o.sponsoredRoutes[0].grants).toBe(800);
    expect(o.sponsoredTotal).toBe(o.sponsoredRoutes.reduce((s, r) => s + r.grants, 0));
    expect(o.sponsoredTotal).toBe(1267);
  });

  it('fails loudly when the header row is missing', () => {
    expect(() => buildOccupation(occ.filter((r) => r[0] !== 'Year'))).toThrow(/no header row/);
  });
});
