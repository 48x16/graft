import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parse } from 'csv-parse/sync';
import { beforeAll, describe, expect, it } from 'vitest';
import { band, buildAsylumSupport, dateWords, isoDate, readD11 } from '../pipeline/sources/asylum-support.js';
import { inputDir } from '../pipeline/lib/util.js';

const fixtureRows = async () =>
  parse(await readFile(join(inputDir('ho-asylum', 'fixture'), 'support-Data_Asy_D11.csv'), 'utf8'), { relax_column_count: true, skip_empty_lines: true });

describe('band (the binding banding rule)', () => {
  it('rounds 10 or more to the nearest 5, bands 1 to 9, keeps 0', () => {
    expect(band(0)).toEqual({ n: 0, band: null });
    expect(band(1)).toEqual({ n: null, band: 'fewer than 10' });
    expect(band(9)).toEqual({ n: null, band: 'fewer than 10' });
    expect(band(10)).toEqual({ n: 10, band: null });
    expect(band(12)).toEqual({ n: 10, band: null });
    expect(band(13)).toEqual({ n: 15, band: null });
    expect(band(3938)).toEqual({ n: 3940, band: null });
  });
  it('refuses non-counts', () => {
    expect(() => band(null)).toThrow();
    expect(() => band(-1)).toThrow();
  });
});

describe('dates', () => {
  it('reads the publisher format and writes words', () => {
    expect(isoDate('30 Jun 2026')).toBe('2026-06-30');
    expect(dateWords('2026-06-30')).toBe('30 June 2026');
    expect(() => isoDate('2026 Q2')).toThrow(/unexpected date/);
  });
});

describe('buildAsylumSupport on the fixture', () => {
  let out;
  const area = (slug) => out.areas.find((a) => a.slug === slug);
  beforeAll(async () => {
    out = buildAsylumSupport(readD11(await fixtureRows()));
  });

  it('indexes every LAD code at the latest date, by name, without placeholders or old codes', () => {
    expect(out.index.updated).toBe('30 June 2024');
    expect(out.index.areas).toEqual([
      { slug: 'glasgow-city', name: 'Glasgow City', code: 'S12000049', region: 'Scotland' },
      { slug: 'leeds', name: 'Leeds', code: 'E08000035', region: 'Yorkshire and The Humber' },
      { slug: 'orkney-islands', name: 'Orkney Islands', code: 'S12000023', region: 'Scotland' },
    ]);
    expect(out.areas.map((a) => a.slug)).toEqual(['glasgow-city', 'leeds', 'orkney-islands']);
  });

  it('writes the contract fields, in order', () => {
    expect(Object.keys(area('leeds'))).toEqual(['slug', 'name', 'code', 'region', 'date', 'total', 'byAccommodation', 'trend', 'regionTotal', 'ukTotal', 'shareOfUk']);
    expect(Object.keys(area('leeds').trend)).toEqual(['dates', 'accommodated', 'hotels']);
  });

  it('rounds area counts, keeps the six types in order, and 0 where there are no rows', () => {
    const g = area('glasgow-city');
    expect(g.date).toBe('30 June 2024');
    expect(g.total).toEqual({ n: 3660, band: null }); // 3512 + 26 + 103 + 12 + 7, across support types
    expect(g.byAccommodation).toEqual([
      { type: 'Dispersal accommodation', count: { n: 3540, band: null } }, // 3538
      { type: 'Initial accommodation', count: { n: 0, band: null } },
      { type: 'Hotels', count: { n: 105, band: null } }, // 103
      { type: 'Other contingency accommodation', count: { n: 10, band: null } }, // 12
      { type: 'Other accommodation', count: { n: 0, band: null } },
      { type: 'Subsistence only', count: { n: null, band: 'fewer than 10' } }, // 7
    ]);
  });

  it('normalises spelling variants of region and accommodation', () => {
    const l = area('leeds');
    expect(l.region).toBe('Yorkshire and The Humber');
    expect(l.byAccommodation.find((t) => t.type === 'Subsistence only').count).toEqual({ n: 10, band: null }); // "Subsistence only", 12
    expect(l.byAccommodation.find((t) => t.type === 'Initial accommodation').count).toEqual({ n: 10, band: null });
    expect(l.total).toEqual({ n: 1235, band: null });
  });

  it('keeps region and UK totals exact, placeholders included', () => {
    const g = area('glasgow-city');
    expect(g.ukTotal).toBe(4898);
    expect(g.regionTotal).toBe(3663); // Glasgow 3660 + Orkney 3, not rounded
    expect(area('leeds').regionTotal).toBe(1235);
    expect(g.shareOfUk).toBeCloseTo(3660 / 4898, 4);
  });

  it('bands small areas and gives them no share', () => {
    const o = area('orkney-islands');
    expect(o.total).toEqual({ n: null, band: 'fewer than 10' });
    expect(o.shareOfUk).toBeNull();
    expect(o.byAccommodation[0].count).toEqual({ n: null, band: 'fewer than 10' });
    // No single digits anywhere in an area file.
    const counts = [o.total, ...o.byAccommodation.map((t) => t.count), ...o.trend.accommodated, ...o.trend.hotels];
    expect(counts.every((c) => c.n === null || c.n === 0 || c.n >= 10)).toBe(true);
  });

  it('builds the trend from 30 June 2023, accommodated only, with 0 for a missing quarter', () => {
    const g = area('glasgow-city');
    expect(g.trend.dates).toEqual(['30 June 2023', '30 September 2023', '31 December 2023', '31 March 2024', '30 June 2024']);
    expect(g.trend.accommodated.map((c) => c.n)).toEqual([3900, 3830, 3650, 3630, 3655]); // excludes subsistence only
    expect(g.trend.hotels.map((c) => c.n)).toEqual([400, 380, 250, 150, 105]);
    const o = area('orkney-islands');
    expect(o.trend.accommodated).toEqual([
      { n: null, band: 'fewer than 10' },
      { n: 0, band: null },
      { n: 0, band: null },
      { n: null, band: 'fewer than 10' },
      { n: null, band: 'fewer than 10' },
    ]);
  });

  it('carries no ranking and no per-person detail', () => {
    for (const a of out.areas) {
      expect(a).not.toHaveProperty('rank');
      expect(a).not.toHaveProperty('nationality');
    }
  });
});

describe('validation', () => {
  it('throws on a changed header', async () => {
    const rows = await fixtureRows();
    rows[1] = rows[1].map((c) => (c === 'LAD Code' ? 'LA code' : c));
    expect(() => readD11(rows)).toThrow(/missing column "LAD Code"/);
  });
  it('throws when the header row is missing', async () => {
    const rows = await fixtureRows();
    expect(() => readD11(rows.filter((_, i) => i !== 1))).toThrow(/no header row/);
  });
  it('throws when a quarter is missing from the trend', async () => {
    const rows = (await fixtureRows()).filter((r) => r[0] !== '30 Sep 2023');
    expect(() => buildAsylumSupport(readD11(rows))).toThrow(/no rows for 30 September 2023/);
  });
  it('throws on an unknown accommodation type', async () => {
    const rows = await fixtureRows();
    rows.push(['30 Jun 2024', 'Section 95', 'Scotland', 'Glasgow City', 'S12000049', 'Barracks', '5']);
    expect(() => buildAsylumSupport(readD11(rows))).toThrow(/unknown accommodation type "barracks"/);
  });
  it('appends the code to clashing slugs', () => {
    const rec = (name, code) => ({ date: '2023-06-30', region: 'Wales', name, code, accommodation: 'dispersal accommodation', people: 20 });
    const out = buildAsylumSupport([rec('Newport', 'W06000022'), rec('Newport', 'E99999999')]);
    expect(out.index.areas.map((a) => a.slug)).toEqual(['newport-e99999999', 'newport-w06000022']);
  });
});
