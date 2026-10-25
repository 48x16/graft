import { describe, expect, it } from 'vitest';
import { clean, num, rowsUnder, slugify } from '../pipeline/lib/util.js';
import { columnIndex, excelDate, parseSharedStrings, parseWorksheet } from '../pipeline/lib/xlsx.js';

describe('cells', () => {
  it('reads numbers, and makes the publishers markers null, never 0', () => {
    expect(num('1,234')).toBe(1234);
    expect(num('42%')).toBeCloseTo(0.42);
    for (const marker of ['[c]', '[x]', '[z]', ':', '..', '-', '', null]) expect(num(marker)).toBeNull();
  });

  it('finds the header row whatever notes it carries', () => {
    expect(clean('Year [note 2]')).toBe('Year');
    expect(rowsUnder([['Title'], ['Year [note 1]', 'Count'], ['2024', '5'], []], 'Year', 'test')).toEqual([{ Year: '2024', Count: '5' }]);
    expect(() => rowsUnder([['x']], 'Year', 'test')).toThrow(/no header row/);
  });

  it('makes file names', () => {
    expect(slugify('Yorkshire & the Humber')).toBe('yorkshire-and-the-humber');
  });
});

describe('xlsx', () => {
  it('reads shared strings (rich text too), numbers, inline strings and gaps', () => {
    const shared = parseSharedStrings('<sst><si><t>Year</t></si><si><r><t>Cou</t></r><r><t>nt</t></r></si></sst>');
    expect(shared).toEqual(['Year', 'Count']);
    const xml = `<worksheet><sheetData>
      <row r="1"><c r="A1" t="s"><v>0</v></c><c r="C1" t="s"><v>1</v></c></row>
      <row r="3"><c r="A3"><v>2024</v></c><c r="C3" t="inlineStr"><is><t>a &amp; b</t></is></c></row>
    </sheetData></worksheet>`;
    expect(parseWorksheet(xml, shared)).toEqual([['Year', '', 'Count'], [], ['2024', '', 'a & b']]);
  });

  it('turns cell references and serial dates around', () => {
    expect(columnIndex('A1')).toBe(0);
    expect(columnIndex('AB12')).toBe(27);
    expect(excelDate(45658).toISOString().slice(0, 10)).toBe('2025-01-01');
  });
});
