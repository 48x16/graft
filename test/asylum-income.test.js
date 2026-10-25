import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parse } from 'csv-parse/sync';
import { beforeAll, describe, expect, it } from 'vitest';
import { buildAsylumIncome, quintileOf, readHousePrices, readIncome, readPopulation, spearman, supportByCode } from '../pipeline/sources/asylum-income.js';
import { readD11 } from '../pipeline/sources/asylum-support.js';
import { inputDir } from '../pipeline/lib/util.js';

const csv = async (source, file) => parse(await readFile(join(inputDir(source, 'fixture'), file), 'utf8'), { relax_column_count: true, skip_empty_lines: true });

let popRows, incomeRows, d11Rows, hpiRows;
beforeAll(async () => {
  popRows = await csv('ons-population', 'MYE4.csv');
  incomeRows = await csv('ons-gdhi', 'Table 3.csv');
  d11Rows = await csv('ho-asylum', 'support-Data_Asy_D11.csv');
  hpiRows = await csv('lr-hpi', 'Average-prices-2026-08.csv');
});
const build = (rows = d11Rows) => buildAsylumIncome(readPopulation(popRows), readIncome(incomeRows), supportByCode(readD11(rows)), readHousePrices(hpiRows));
const barnsleyRow = (code, people) => ['30 Jun 2024', 'Section 95', 'Yorkshire and The Humber', 'Barnsley', code, 'Dispersal Accommodation', String(people)];

describe('readers', () => {
  it('keeps districts only from MYE4 (no UK, region or county rows) and takes the newest year', () => {
    const p = readPopulation(popRows);
    expect(p.period).toBe('mid-2025');
    expect(p.byCode.size).toBe(12);
    expect(p.byCode.has('K02000001') || p.byCode.has('E12000008') || p.byCode.has('E10000030')).toBe(false);
    expect(p.byCode.get('S12000049')).toEqual({ name: 'Glasgow City', population: 654330 });
  });
  it('reads GDHI per head for the latest year, even where an older year is blank', () => {
    const g = readIncome(incomeRows);
    expect(g.year).toBe('2024');
    expect(g.byCode.get('S12000023')).toEqual({ region: 'Scotland', name: 'Orkney Islands', incomePerHead: 25234 });
  });
  it('fails loudly on a changed header', () => {
    expect(() => readPopulation(popRows.map((r) => (r[0] === 'Code' ? ['LAD', ...r.slice(1)] : r)))).toThrow(/no header row starting "Code"/);
    expect(() => readIncome(incomeRows.map((r) => (r[0] === 'Region' ? ['Region', 'Code', ...r.slice(2)] : r)))).toThrow(/missing column "LAD code"/);
  });
});

describe('buildAsylumIncome on the fixtures', () => {
  let out;
  const area = (code) => out.areas.find((a) => a.code === code);
  beforeAll(() => {
    out = build();
  });

  it('writes the contract fields, in order', () => {
    expect(Object.keys(out)).toEqual(['updated', 'areas', 'quintiles', 'quintilesOutsideLondon', 'quintilesByHousePrice', 'correlation', 'correlationHousePrice', 'highest', 'lowest', 'noneOrFew']);
    expect(out.updated).toEqual({ support: '30 June 2024', population: 'mid-2025', income: '2024 (provisional)', housePrice: 'August 2026' });
    expect(Object.keys(out.areas[0])).toEqual(['code', 'name', 'region', 'population', 'incomePerHead', 'housePrice', 'supported', 'ratePer10k', 'quintile']);
    expect(Object.keys(out.quintiles[0])).toEqual(['quintile', 'incomeFrom', 'incomeTo', 'areas', 'population', 'supported', 'ratePer10k', 'fewerThan10OrNone']);
    expect(Object.keys(out.highest[0])).toEqual(['code', 'name', 'region', 'ratePer10k', 'supported', 'incomePerHead', 'quintile']);
    expect(JSON.stringify(out)).not.toMatch(/exact|death/i);
  });

  it('every district is an area, with the asylum-support banding and rates from the rounded count', () => {
    expect(out.areas).toHaveLength(12);
    // Glasgow: 3,660 exactly at 30 June 2024 (already a multiple of 5); Leeds 1,235.
    expect(area('S12000049')).toMatchObject({ population: 654330, incomePerHead: 20974, supported: { n: 3660, band: null }, ratePer10k: 55.9, region: 'Scotland' });
    expect(area('E08000035')).toMatchObject({ supported: { n: 1235, band: null }, ratePer10k: 14.7 });
    // Orkney: 3 people, banded, so no rate (never 0).
    expect(area('S12000023').supported).toEqual({ n: null, band: 'fewer than 10' });
    expect(area('S12000023').ratePer10k).toBeNull();
    // No D11 row at all: none listed, rate 0.
    expect(area('E06000046')).toMatchObject({ supported: { n: 0, band: null }, ratePer10k: 0 });
  });

  it('cuts fifths by income per head, lowest first', () => {
    expect(out.quintiles.map((q) => q.areas)).toEqual([3, 2, 3, 2, 2]);
    expect(area('E08000026').quintile).toBe(1); // Coventry, the lowest income here
    expect(area('E09000020').quintile).toBe(5); // Kensington and Chelsea, the highest
    for (const q of out.quintiles) {
      const inQ = out.areas.filter((a) => a.quintile === q.quintile);
      expect(q.areas).toBe(inQ.length);
      expect(q.population).toBe(inQ.reduce((s, a) => s + a.population, 0));
      expect(q.incomeFrom).toBe(Math.min(...inQ.map((a) => a.incomePerHead)));
      expect(q.incomeTo).toBe(Math.max(...inQ.map((a) => a.incomePerHead)));
    }
    expect(out.quintiles.reduce((s, q) => s + q.population, 0)).toBe(out.areas.reduce((s, a) => s + a.population, 0));
  });

  it('sums EXACT counts in quintiles, so a banded area still counts', () => {
    expect(out.quintiles.map((q) => q.supported)).toEqual([3660, 1235, 3, 0, 0]); // Orkney's 3 in the third fifth
    expect(out.quintiles[0].ratePer10k).toBe(Math.round((3660 / 1598613) * 100000) / 10);
    expect(out.quintiles.map((q) => q.fewerThan10OrNone)).toEqual([2, 1, 3, 2, 2]);
  });

  it('re-cuts the fifths without London', () => {
    const q = out.quintilesOutsideLondon;
    expect(q.reduce((s, r) => s + r.areas, 0)).toBe(9);
    expect(q.reduce((s, r) => s + r.population, 0)).toBe(out.areas.filter((a) => !a.code.startsWith('E09')).reduce((s, a) => s + a.population, 0));
    // Glasgow moves from the first fifth to the second once London is out.
    expect(q.map((r) => r.supported)).toEqual([0, 3660, 1235, 3, 0]);
    expect(q[4]).toMatchObject({ incomeFrom: 51161, incomeTo: 51161, areas: 1 }); // Elmbridge alone
  });

  it('ranks only districts of 25,000+ with a rate; lowest needs at least 10 people', () => {
    expect(out.highest).toHaveLength(10);
    expect(out.highest.slice(0, 2).map((a) => a.name)).toEqual(['Glasgow City', 'Leeds']);
    const codes = [...out.highest, ...out.lowest].map((a) => a.code);
    expect(codes).not.toContain('E09000001'); // City of London, population 15,631
    expect(codes).not.toContain('S12000023'); // Orkney, banded
    expect(out.lowest.map((a) => a.name)).toEqual(['Leeds', 'Glasgow City']);
    expect(out.lowest.every((a) => a.supported.n >= 10)).toBe(true);
  });

  it('counts banded and empty districts by fifth', () => {
    expect(out.noneOrFew).toEqual({ count: 10, inTopQuintile: 2, inBottomQuintile: 2 });
  });

  it('adds house prices: Barnsley and Sheffield re-coded, a district with no figure is null, not 0', () => {
    expect(area('E08000016').housePrice).toBe(173053); // E08000038 in the UK HPI
    expect(area('E08000019').housePrice).toBe(217603); // E08000039
    expect(area('S12000049').housePrice).toBe(194382); // August, not July (194,061)
    expect(area('E09000001').housePrice).toBeNull(); // City of London is left out of this fixture, as the Isles of Scilly are in the real file
  });

  it('cuts house-price fifths over priced districts only, with exact sums', () => {
    const q = out.quintilesByHousePrice;
    expect(Object.keys(q[0])).toEqual(['quintile', 'priceFrom', 'priceTo', 'areas', 'population', 'supported', 'ratePer10k', 'fewerThan10OrNone']);
    expect(q.map((r) => r.areas)).toEqual([3, 2, 2, 2, 2]); // 11: City of London has no price
    expect(q.reduce((s, r) => s + r.population, 0)).toBe(out.areas.filter((a) => a.housePrice !== null).reduce((s, a) => s + a.population, 0));
    expect(q.map((r) => r.supported)).toEqual([3663, 0, 1235, 0, 0]); // Barnsley, Glasgow, Orkney (3, banded) in the cheapest fifth
    expect(q[0]).toMatchObject({ priceFrom: 173053, priceTo: 216479, ratePer10k: 39.4 });
    expect(q[4]).toMatchObject({ priceFrom: 887206, priceTo: 1204072 });
  });

  it('gives a rank correlation between house price and rate, on the same districts as for income', () => {
    expect(out.correlationHousePrice).toBe(-0.29);
  });

  it('gives a rank correlation between income and rate', () => {
    expect(out.correlation).toBe(-0.28);
  });
});

describe('code mapping', () => {
  it('re-codes Barnsley (E08000038) to the ONS code E08000016', () => {
    const out = build([...d11Rows, barnsleyRow('E08000038', 12)]);
    const barnsley = out.areas.find((a) => a.code === 'E08000016');
    expect(barnsley.supported).toEqual({ n: 10, band: null });
    expect(barnsley.ratePer10k).toBe(Math.round((10 / 252784) * 100000) / 10);
    expect(out.areas.find((a) => a.code === 'E08000038')).toBeUndefined();
  });
  it('fails loudly on any other unmatched asylum code', () => {
    expect(() => build([...d11Rows, barnsleyRow('E08000099', 12)])).toThrow(/E08000099/);
  });
});

describe('readHousePrices', () => {
  it('takes the latest month and names it', () => {
    const h = readHousePrices(hpiRows);
    expect(h.month).toBe('August 2026');
    expect(h.byCode.get('K02000001')).toBe(273037); // UK, matching the release's "£273,000"
    expect(h.byCode.has('E08000038')).toBe(false);
  });
  it('fails loudly on a changed header', () => {
    expect(() => readHousePrices(hpiRows.map((r, i) => (i === 0 ? r.map((c) => (c === 'Average_Price' ? 'Price' : c)) : r)))).toThrow(/missing column "Average_Price"/);
  });
});

describe('helpers', () => {
  it('spearman: perfect, inverse and tied ranks', () => {
    expect(spearman([1, 2, 3, 4], [10, 20, 30, 40])).toBe(1);
    expect(spearman([1, 2, 3, 4], [4, 3, 2, 1])).toBe(-1);
    expect(spearman([1, 2, 3, 4], [0, 0, 1, 1])).toBeCloseTo(0.894, 3);
  });
  it('quintileOf splits 361 districts 73/72/72/72/72', () => {
    const areas = Array.from({ length: 361 }, (_, i) => ({ code: `X${String(i).padStart(8, '0')}`, incomePerHead: 20000 + i }));
    const q = quintileOf(areas);
    expect([1, 2, 3, 4, 5].map((k) => [...q.values()].filter((v) => v === k).length)).toEqual([73, 72, 72, 72, 72]);
  });
});
