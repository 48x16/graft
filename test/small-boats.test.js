import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'csv-parse/sync';
import { describe, expect, it } from 'vitest';
import { buildArrivals, buildClaimed, buildMonths, buildReturns, buildSmallBoatReturns, buildSmallBoats } from '../pipeline/sources/small-boats.js';
import { ROOT } from '../pipeline/lib/util.js';

const csv = (source, sheet) => parse(readFileSync(join(ROOT, 'test', 'fixtures', source, `${sheet}.csv`), 'utf8'), { relax_column_count: true });
const tables = () => ({
  ier02a: csv('ho-irregular', 'IER_02a'),
  ier02d: csv('ho-irregular', 'IER_02d'),
  ierD01: csv('ho-irregular', 'Data_IER_D01'),
  retD01: csv('ho-returns', 'Data_Ret_D01'),
  ret06a: csv('ho-returns', 'Ret_06a'),
});

describe('small-boats: months (IER_02a)', () => {
  const { months, perBoat } = buildMonths(tables().ier02a);
  it('fills a missing year with nulls and keeps unpublished months null', () => {
    expect(months.years).toEqual([2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026]);
    expect(months.arrivals[1]).toEqual(Array(12).fill(null));
    expect(months.arrivals[8].slice(0, 6)).toEqual([933, 1276, 2232, 1975, 2726, 2742]);
    expect(months.arrivals[8].slice(6)).toEqual(Array(6).fill(null));
    expect(months.arrivals[0][1]).toBe(0); // a real zero stays 0
  });
  it('strips "[Note n]" from labels', () => {
    expect(months.arrivals[7][7]).toBe(3567); // "2025 arrivals [Note 9]"
  });
  it('people per boat, with a part year labelled as such', () => {
    expect(perBoat.map((p) => p.year)).toEqual([2018, 2025, 2026]);
    expect(perBoat[0]).toEqual({ year: 2018, label: '2018', people: 299, boats: 43, perBoat: 7 });
    expect(perBoat[2]).toMatchObject({ label: 'January to June 2026', people: 11884, boats: 182, perBoat: 65.3 });
  });
  it('throws if the header row changes', () => {
    expect(() => buildMonths([['Year', 'Jan']])).toThrow(/IER_02a/);
  });
});

describe('small-boats: arrivals (Data_IER_D01)', () => {
  const a = buildArrivals(tables().ierD01);
  it('builds complete years ending June only, latest provisional', () => {
    expect(a.years).toEqual([
      { year: 2025, label: 'year ending June 2025', provisional: false },
      { year: 2026, label: 'year ending June 2026', provisional: true },
    ]);
    expect(a.arrivals).toEqual([800, 908]);
  });
  it('detections by method for the latest year', () => {
    expect(a.detections).toEqual({ smallBoat: 908, air: 48, inCountry: 24, ports: 4 });
  });
  it('ranks nationalities without "Not currently recorded", keeping it in totals', () => {
    expect(a.nationalities.map((n) => n.name)).toEqual(['Eritrea', 'Syria', 'Somalia']);
    expect(a.nationalities[0]).toEqual({ name: 'Eritrea', arrivals: 700, previous: 400 });
    expect(a.nationalities[2].previous).toBe(0); // absent the year before: a real zero
    expect(a.notRecorded).toBe(120);
  });
  it('age and sex, with "Not currently recorded" in unknownSex', () => {
    expect(a.ageSex).toEqual({ male: 680, female: 100, unknownSex: 128, under18: 100 });
  });
  it('throws if a method of entry disappears', () => {
    const rows = tables().ierD01.filter((r) => r[2] !== 'Recorded detections at UK ports');
    expect(() => buildArrivals(rows)).toThrow(/Recorded detections at UK ports/);
  });
});

describe('small-boats: claims (IER_02d)', () => {
  const c = buildClaimed(tables().ier02d);
  it('shares are fractions of that year; a suppressed cell stays null', () => {
    expect(c[1]).toEqual({ year: 2025, asylumOnly: 0.7888, asylumAndNrm: 0.1953, neither: 0.0133, arrivals: 40595 });
    expect(c[0].asylumAndNrm).toBeNull();
    expect(c[0].arrivals).toBe(285);
  });
});

describe('small-boats: returns', () => {
  it('sums return type groups by year ending June; latest seven quarters provisional', () => {
    const r = buildReturns(tables().retD01);
    expect(r.years.map((y) => [y.year, y.provisional])).toEqual([[2024, false], [2025, true], [2026, true]]);
    expect(r.enforced).toEqual([86, 102, 118]); // case variants of return type merged
    expect(r.voluntary).toEqual([200, 200, 200]);
    expect(r.refusedAtPort).toEqual([114, 98, 82]);
  });
  it('throws on an unknown return type group', () => {
    const rows = tables().retD01;
    rows[2][4] = 'Deportation';
    expect(() => buildReturns(rows)).toThrow(/unknown return type group/);
  });
  it('small boat returns: quarter rows only, [p] read, last four summed', () => {
    const s = buildSmallBoatReturns(tables().ret06a);
    expect(s.quarters).toHaveLength(10);
    expect(s.quarters[0]).toEqual({ key: '2024 Q1', label: 'January to March 2024', provisional: false });
    expect(s.quarters.at(-1)).toEqual({ key: '2026 Q2', label: 'April to June 2026', provisional: true });
    expect(s.returns).not.toContain(2345); // "2024 Total" row dropped
    expect(s.latestYear).toBe(3310);
  });
});

describe('small-boats: the page', () => {
  const d = buildSmallBoats(tables());
  it('matches the contract keys, in order', () => {
    expect(Object.keys(d)).toEqual(['updated', 'months', 'perBoat', 'years', 'arrivals', 'detections', 'nationalities', 'notRecorded', 'ageSex', 'claimed', 'returns', 'smallBoatReturns']);
    expect(d.updated).toBe('year ending June 2026');
    expect(d.arrivals).toHaveLength(d.years.length);
    expect(d.returns.enforced).toHaveLength(d.returns.years.length);
    expect(d.smallBoatReturns.returns).toHaveLength(d.smallBoatReturns.quarters.length);
  });
  it('carries nothing about deaths, offenders or NRM outcomes', () => {
    expect(JSON.stringify(d)).not.toMatch(/death|dead|died|fatal|offender|conclusive/i);
  });
});
