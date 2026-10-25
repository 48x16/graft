import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ROOT } from '../pipeline/lib/util.js';
import { decodeRk, openWorkbook, parseSst, readWorkbook } from '../pipeline/lib/xls.js';
import { writeXls } from './fixtures/ons-birth/write-xls.js';

const FIXTURE = join(ROOT, 'test', 'fixtures', 'ons-birth', 'emp06aug2026.xls');

describe('xls on the EMP06 fixture', () => {
  it('lists the worksheets in order', async () => {
    const book = await readWorkbook(FIXTURE);
    expect(book.names).toEqual(['Note', 'Introduction', 'Country of birth levels', 'Country of birth rates', 'Nationality Levels', 'Nationality rates']);
  });

  it('reads shared strings, MULRK integers, RK, NUMBER decimals, FORMULA results and LABEL', async () => {
    const book = await readWorkbook(FIXTURE);
    const levels = await book.sheet('Country of birth levels');
    expect(levels[0][0]).toMatch(/^Table EMP06: Employment levels by country of birth/);
    expect(levels[1]).toEqual(['Date of publication:', '46252']); // a lone RK
    expect(levels[9][3]).toBe('Total\nNon UK'); // newlines survive
    expect(levels[10].slice(0, 4)).toEqual(['Dataset identifier code', 'MGTM', 'JF6F', 'JF6G']);
    expect(levels[11]).toEqual([]); // blank rows stay, as empty arrays
    expect(levels.at(-1)[0]).toMatch(/proxy for flows/);
    const last = levels.find((r) => r[0] === 'Apr-Jun 2026');
    expect(last.slice(1, 6)).toEqual(['34426383', '26760770', '7662069', '2275380', '5386689']);
    expect(last[6]).toBe('..');

    const rates = await book.sheet('Country of birth rates');
    const r26 = rates.find((r) => r[0] === 'Apr-Jun 2026');
    expect(r26[1]).toBe('74.984302'); // FORMULA with a cached number
    expect(r26[2]).toBe('74.598311'); // NUMBER
    expect(rates.find((r) => r[0] === 'Apr-Jun 1997')[4]).toBe('*');

    const natRates = await book.sheet('Nationality rates');
    expect(natRates[10][0]).toBe('Dataset identifier code'); // a LABEL record
  });

  it('names the sheets it has when asked for one it has not', async () => {
    const book = await readWorkbook(FIXTURE);
    expect(() => book.sheet('Nationality levels')).toThrow(/no sheet named "Nationality levels".*Nationality Levels/);
  });

  it('refuses files that are not old-style Excel', () => {
    expect(() => openWorkbook(Buffer.from('PK\u0003\u0004 not a compound file'.padEnd(600)))).toThrow(/Compound File signature/);
  });
});

describe('xls records', () => {
  it('decodes all four kinds of RK number', () => {
    expect(decodeRk((123 << 2) | 2)).toBe(123);
    expect(decodeRk(((-5 << 2) | 2) >>> 0)).toBe(-5);
    expect(decodeRk((7460 << 2) | 3)).toBeCloseTo(74.6); // integer ÷ 100
    const b = Buffer.alloc(8);
    b.writeDoubleLE(1.5);
    const high = b.readUInt32LE(4);
    expect(decodeRk(high)).toBe(1.5); // top 30 bits of a double
    expect(decodeRk(high | 1)).toBe(0.015);
  });

  it('joins shared strings split across CONTINUE records, switching byte width mid-string', () => {
    const u32 = (n) => [n & 0xff, (n >> 8) & 0xff, (n >> 16) & 0xff, n >>> 24];
    // "abcdef" (8-bit) breaks after "abc"; the CONTINUE restarts with flags 1 (UTF-16) for "def".
    const part1 = Buffer.from([...u32(1), ...u32(1), 6, 0, 0, ...Buffer.from('abc', 'latin1')]);
    const part2 = Buffer.from([1, ...Buffer.from('def', 'utf16le')]);
    expect(parseSst([part1, part2])).toEqual(['abcdef']);
  });

  it('round-trips a small workbook held in the mini stream, with tiny SST records', () => {
    const rows = [['Ünïcode — “quotes”', 'Łódź', '', 'plain'], [1, 2, 3, { rk: (7460 << 2) | 3 }], [{ formula: 'text result' }, { formula: 2.5 }, -7, 0.1]];
    const buf = writeXls([{ name: 'Données', rows }, { name: 'Empty', rows: [] }], { maxRecord: 20 });
    const book = openWorkbook(buf);
    expect(book.names).toEqual(['Données', 'Empty']);
    expect(book.sheet('Données')).toEqual([
      ['Ünïcode — “quotes”', 'Łódź', '', 'plain'],
      ['1', '2', '3', '74.6'],
      ['text result', '2.5', '-7', '0.1'],
    ]);
    expect(book.sheet('Empty')).toEqual([]);
  });

  it('reads a workbook big enough to need several FAT sectors', () => {
    const rows = Array.from({ length: 3000 }, (_, i) => [`row ${i}`, i, i + 0.5]);
    const book = openWorkbook(writeXls([{ name: 'Big', rows }]));
    const out = book.sheet('Big');
    expect(out).toHaveLength(3000);
    expect(out[2999]).toEqual(['row 2999', '2999', '2999.5']);
  });
});
