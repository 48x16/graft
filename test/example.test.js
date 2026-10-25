import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'csv-parse/sync';
import { describe, expect, it } from 'vitest';
import { buildExample } from '../pipeline/sources/example.js';

const rows = parse(readFileSync(join(import.meta.dirname, 'fixtures', 'example', 'example.csv'), 'utf8'), { columns: true });

describe('buildExample', () => {
  const d = buildExample(rows);

  it('adds up applications and grants by year', () => {
    expect(d.years).toEqual([2019, 2020, 2021, 2022, 2023, 2024]);
    const y2019 = rows.filter((r) => r.year === '2019').reduce((s, r) => s + Number(r.applications), 0);
    expect(d.applications[0]).toBe(y2019);
    expect(d.updated).toBe('2024');
  });

  it('gives each group its share granted, this year and last', () => {
    for (const g of d.groups) {
      expect(g.share).toBeGreaterThan(0);
      expect(g.share).toBeLessThan(1);
      expect(g.before).not.toBeNull();
    }
  });

  it('fails loudly when a column is missing', () => {
    expect(() => buildExample([{ year: '2024', group: 'A' }])).toThrow(/missing columns/);
  });
});
