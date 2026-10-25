import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'csv-parse/sync';
import { describe, expect, it } from 'vitest';
import { buildNetMigration, buildRevision, editionOf, parsePeriod } from '../pipeline/sources/net-migration.js';

const dir = join(import.meta.dirname, 'fixtures', 'ons-ltim');
const sheet = (s) => parse(readFileSync(join(dir, `${s}.csv`), 'utf8'), { relax_column_count: true });
const sheets = Object.fromEntries(['1', '2', '4b', '5'].map((s) => [s, sheet(s)]));
const d = buildNetMigration(sheets);

describe('parsePeriod', () => {
  it('reads keys, labels and flags', () => {
    expect(parsePeriod('YE Dec 25 P')).toEqual({ key: '2025-12', label: 'year ending December 2025', provisional: true, revised: false });
    expect(parsePeriod('YE Mar 25 P R')).toMatchObject({ key: '2025-03', provisional: true, revised: true });
    expect(parsePeriod('YE Jun 12')).toMatchObject({ provisional: false, revised: false });
    expect(() => parsePeriod('2025')).toThrow(/can't read period/);
  });
});

describe('buildNetMigration', () => {
  it('has the contract keys in order', () => {
    expect(Object.keys(d)).toEqual(['updated', 'periods', 'flows', 'interval', 'reasons', 'revision']);
    expect(Object.keys(d.flows)).toEqual(['immigration', 'emigration', 'net']);
    expect(Object.keys(d.flows.net)).toEqual(['all', 'british', 'euPlus', 'nonEuPlus']);
    expect(Object.keys(d.reasons.immigration)).toEqual(['work', 'workMain', 'workDependant', 'study', 'studyMain', 'studyDependant', 'family', 'humanitarian', 'asylum', 'other']);
    expect(Object.keys(d.reasons)).toEqual(['periods', 'immigration', 'net']);
  });

  it('reads the headline figures for the year ending December 2025', () => {
    expect(d.updated).toBe('year ending December 2025');
    const last = d.periods.length - 1;
    expect(d.flows.net.all[last]).toBe(171000);
    expect(d.flows.immigration.all[last]).toBe(813000);
    expect(d.flows.emigration.all[last]).toBe(642000);
    expect(d.flows.net.british[last]).toBe(-136000);
    expect(d.interval).toEqual({ label: 'year ending December 2025', net: 171000, lower: 145000, upper: 197000 });
  });

  it('orders periods oldest first with flags and the June 2021 method break', () => {
    expect(d.periods.map((p) => p.key)).toEqual(['2020-12', '2021-06', '2023-06', '2024-12', '2025-12']);
    expect(d.periods.map((p) => p.newMethod)).toEqual([false, true, true, true, true]);
    expect(d.periods[3]).toMatchObject({ revised: true, provisional: false });
    expect(d.periods[4]).toMatchObject({ provisional: true, revised: false });
  });

  it('keeps every series aligned, with missing rows and blank cells as null', () => {
    for (const flow of Object.values(d.flows)) for (const s of Object.values(flow)) expect(s).toHaveLength(d.periods.length);
    expect(d.flows.emigration.all[2]).toBeNull(); // no emigration row for YE Jun 23 in the fixture
    expect(d.flows.immigration.british[0]).toBeNull(); // blank cell, not 0
    expect(d.flows.net.all[2]).toBe(924000);
    expect(d.reasons.net.other.at(-1)).toBeNull();
  });

  it('reads non-EU+ reasons, keeping real zeros and negatives', () => {
    expect(d.reasons.periods.map((p) => p.key)).toEqual(['2023-06', '2024-12', '2025-12']);
    expect(Object.keys(d.reasons.periods[0])).toEqual(['key', 'label', 'provisional']);
    const i = d.reasons.immigration;
    expect(i.study.at(-1)).toBe(294000);
    expect(i.work.at(-1)).toBe(146000);
    expect(i.asylum.at(-1)).toBe(88000);
    expect(d.reasons.net.studyDependant.at(-1)).toBe(-6000);
    expect(d.reasons).not.toHaveProperty('emigration');
  });

  it('fails loudly when a sheet or column is missing', () => {
    expect(() => buildNetMigration({ ...sheets, '4b': undefined })).toThrow(/sheet "4b" missing/);
    const broken = sheets['1'].map((r, i) => (i === 5 ? r.map((c) => (c.startsWith('British') ? 'UK' : c)) : r));
    expect(() => buildNetMigration({ ...sheets, 1: broken })).toThrow(/missing column "British"/);
  });
});

describe('buildRevision', () => {
  it('takes the latest YE December with a completed estimate and drops difference rows', () => {
    expect(d.revision.label).toBe('year ending December 2024');
    expect(d.revision.stages.map((s) => s.stage)).toEqual(['First published', 'Revised with 6 months of travel data', 'Latest']);
    expect(d.revision.stages[0]).toMatchObject({ net: 431000, british: -17000, britishEmigration: 77000 });
    expect(d.revision.stages.at(-1)).toMatchObject({ net: 331000, british: -117000, britishEmigration: 257000 });
  });

  it('falls back to the latest period, skipping "Not published" stages', () => {
    const noDec = sheets['5'].filter((r) => !String(r[0]).startsWith('YE Dec'));
    const r = buildRevision(noDec);
    expect(r.label).toBe('year ending June 2025');
    expect(r.stages.map((s) => s.net)).toEqual([204000, 219000]);
  });
});

describe('editionOf', () => {
  it('names editions from ONS file names', () => {
    expect(editionOf('may2026publicationspreadsheet.xlsx')).toBe('may2026');
    expect(editionOf('ltimnov25.xlsx')).toBe('nov2025');
    expect(editionOf('ltim-may2026.xlsx')).toBe('may2026');
  });
});
