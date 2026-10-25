// A tiny BIFF8 (.xls) writer, only for building test files for pipeline/lib/xls.js: the
// fixture emp06aug2026.xls (see make-fixture.js) and in-memory workbooks in test/xls.test.js.
// Not used by the pipeline.
//
// Cells: a string → SST + LABELSST; { label: 's' } → LABEL; an integer → RK, or MULRK for a run
// of integers; any other number → NUMBER; { formula: n | 's' } → FORMULA with a cached result
// (and a STRING record for text); { rk: n } → RK as given (for ×100 and double RKs); '' or
// null → no record.

const u16 = (n) => [n & 0xff, (n >> 8) & 0xff];
const u32 = (n) => [n & 0xff, (n >>> 8) & 0xff, (n >>> 16) & 0xff, (n >>> 24) & 0xff];
const dbl = (v) => {
  const b = Buffer.alloc(8);
  b.writeDoubleLE(v);
  return [...b];
};
const isHigh = (s) => [...s].some((c) => c.charCodeAt(0) > 0xff);
const charBytes = (s, high) => (high ? [...Buffer.from(s, 'utf16le')] : [...Buffer.from(s, 'latin1')]);
const record = (type, data) => [...u16(type), ...u16(data.length), ...data];
const isRkInt = (v) => typeof v === 'number' && Number.isInteger(v) && Math.abs(v) < 2 ** 29;

/** The SST and its CONTINUE records, split at `max` bytes as Excel does (headers never split). */
function sstRecords(strings, total, max) {
  const parts = [];
  let cur = [...u32(total), ...u32(strings.length)];
  const room = () => max - cur.length;
  for (const s of strings) {
    const high = isHigh(s);
    if (room() < 3) {
      parts.push(cur);
      cur = [];
    }
    cur.push(...u16(s.length), high ? 1 : 0);
    for (const c of s) {
      const bytes = charBytes(c, high);
      if (room() < bytes.length) {
        parts.push(cur);
        cur = [high ? 1 : 0];
      }
      cur.push(...bytes);
    }
  }
  parts.push(cur);
  return parts.flatMap((p, i) => record(i === 0 ? 0x00fc : 0x003c, p));
}

function bof(dt) {
  return record(0x0809, [...u16(0x0600), ...u16(dt), ...u16(0x0dbb), ...u16(0x07cc), ...u32(0), ...u32(0x0006)]);
}

function cellRecords(rows, sstIndex) {
  const out = [];
  const xf = u16(0x0f);
  rows.forEach((row, r) => {
    for (let c = 0; c < row.length; c++) {
      const v = row[c];
      if (v === '' || v == null) continue;
      if (isRkInt(v) && isRkInt(row[c + 1])) {
        let end = c;
        while (isRkInt(row[end + 1])) end++;
        const data = [...u16(r), ...u16(c)];
        for (let k = c; k <= end; k++) data.push(...xf, ...u32(((row[k] << 2) | 2) >>> 0));
        out.push(...record(0x00bd, [...data, ...u16(end)]));
        c = end;
      } else if (isRkInt(v)) out.push(...record(0x027e, [...u16(r), ...u16(c), ...xf, ...u32(((v << 2) | 2) >>> 0)]));
      else if (typeof v === 'number') out.push(...record(0x0203, [...u16(r), ...u16(c), ...xf, ...dbl(v)]));
      else if (typeof v === 'string') out.push(...record(0x00fd, [...u16(r), ...u16(c), ...xf, ...u32(sstIndex.get(v))]));
      else if ('rk' in v) out.push(...record(0x027e, [...u16(r), ...u16(c), ...xf, ...u32(v.rk >>> 0)]));
      else if ('label' in v) {
        const high = isHigh(v.label);
        out.push(...record(0x0204, [...u16(r), ...u16(c), ...xf, ...u16(v.label.length), high ? 1 : 0, ...charBytes(v.label, high)]));
      } else if ('formula' in v) {
        const text = typeof v.formula === 'string';
        const result = text ? [0, 0, 0, 0, 0, 0, 0xff, 0xff] : dbl(v.formula);
        out.push(...record(0x0006, [...u16(r), ...u16(c), ...xf, ...result, ...u16(0), ...u32(0), ...u16(0)]));
        if (text) {
          const high = isHigh(v.formula);
          out.push(...record(0x0207, [...u16(v.formula.length), high ? 1 : 0, ...charBytes(v.formula, high)]));
        }
      }
    }
  });
  return out;
}

/** The Workbook stream for sheets [{ name, rows }]. */
export function biffStream(sheets, { maxRecord = 8224 } = {}) {
  const strings = [];
  const sstIndex = new Map();
  let total = 0;
  for (const s of sheets)
    for (const row of s.rows)
      for (const v of row)
        if (typeof v === 'string' && v !== '') {
          total++;
          if (!sstIndex.has(v)) sstIndex.set(v, strings.push(v) - 1);
        }
  const sheetBytes = sheets.map((s) => [...bof(0x0010), ...cellRecords(s.rows, sstIndex), ...record(0x000a, [])]);
  const boundsheet = (s, pos) => {
    const high = isHigh(s.name);
    return record(0x0085, [...u32(pos), 0, 0, s.name.length, high ? 1 : 0, ...charBytes(s.name, high)]);
  };
  const globalsLen = bof(0x0005).length + sheets.reduce((n, s) => n + boundsheet(s, 0).length, 0) + sstRecords(strings, total, maxRecord).length + 4;
  let pos = globalsLen;
  const globals = [...bof(0x0005)];
  sheets.forEach((s, i) => {
    globals.push(...boundsheet(s, pos));
    pos += sheetBytes[i].length;
  });
  globals.push(...sstRecords(strings, total, maxRecord), ...record(0x000a, []));
  return Buffer.from([...globals, ...sheetBytes.flat()]);
}

const END = 0xfffffffe;
const FREE = 0xffffffff;

/** A Compound File holding one stream. Streams under 4096 bytes go in the mini stream. */
export function compoundFile(name, data) {
  const S = 512;
  const mini = data.length < 4096;
  const sectorsOf = (n) => Math.ceil(n / S);
  const miniCount = mini ? Math.ceil(data.length / 64) : 0;
  const miniFatSectors = mini ? sectorsOf(miniCount * 4) : 0;
  const miniStreamSectors = mini ? sectorsOf(miniCount * 64) : 0;
  const streamSectors = mini ? 0 : sectorsOf(data.length);
  const others = 1 + miniFatSectors + miniStreamSectors + streamSectors;
  let fatSectors = 1;
  while (fatSectors * 128 < fatSectors + others) fatSectors++;
  if (fatSectors > 109) throw new Error('write-xls: too big for a test file');

  const fat = [];
  for (let i = 0; i < fatSectors; i++) fat.push(0xfffffffd);
  const run = (count) => {
    const start = fat.length;
    for (let i = 0; i < count; i++) fat.push(i === count - 1 ? END : start + i + 1);
    return count ? start : END;
  };
  const dirStart = run(1);
  const miniFatStart = run(miniFatSectors);
  const miniStreamStart = run(miniStreamSectors);
  const streamStart = run(streamSectors);
  while (fat.length % 128) fat.push(FREE);

  const entry = (ename, type, child, start, size) => {
    const b = Buffer.alloc(128);
    b.write(ename, 0, 'utf16le');
    b.writeUInt16LE((ename.length + 1) * 2, 0x40);
    b[0x42] = type;
    b[0x43] = 1;
    b.writeUInt32LE(FREE, 0x44);
    b.writeUInt32LE(FREE, 0x48);
    b.writeUInt32LE(child, 0x4c);
    b.writeUInt32LE(start, 0x74);
    b.writeUInt32LE(size, 0x78);
    return b;
  };
  const empty = () => {
    const b = Buffer.alloc(128);
    b.writeUInt32LE(FREE, 0x44);
    b.writeUInt32LE(FREE, 0x48);
    b.writeUInt32LE(FREE, 0x4c);
    return b;
  };
  const dir = Buffer.concat([
    entry('Root Entry', 5, 1, mini ? miniStreamStart : END, mini ? miniCount * 64 : 0),
    entry(name, 2, FREE, mini ? 0 : streamStart, data.length),
    empty(),
    empty(),
  ]);

  const header = Buffer.alloc(S);
  Buffer.from('d0cf11e0a1b11ae1', 'hex').copy(header, 0);
  header.writeUInt16LE(0x003e, 0x18);
  header.writeUInt16LE(3, 0x1a);
  header.writeUInt16LE(0xfffe, 0x1c);
  header.writeUInt16LE(9, 0x1e);
  header.writeUInt16LE(6, 0x20);
  header.writeUInt32LE(fatSectors, 0x2c);
  header.writeUInt32LE(dirStart, 0x30);
  header.writeUInt32LE(4096, 0x38);
  header.writeUInt32LE(mini ? miniFatStart : END, 0x3c);
  header.writeUInt32LE(miniFatSectors, 0x40);
  header.writeUInt32LE(END, 0x44);
  for (let i = 0; i < 109; i++) header.writeUInt32LE(i < fatSectors ? i : FREE, 0x4c + i * 4);

  const pad = (b) => Buffer.concat([b, Buffer.alloc((S - (b.length % S)) % S)]);
  const fatBuf = Buffer.alloc(fat.length * 4);
  fat.forEach((v, i) => fatBuf.writeUInt32LE(v >>> 0, i * 4));
  const parts = [header, fatBuf, pad(dir)];
  if (mini) {
    const mf = Buffer.alloc(miniFatSectors * S, 0xff);
    for (let i = 0; i < miniCount; i++) mf.writeUInt32LE(i === miniCount - 1 ? END : i + 1, i * 4);
    parts.push(mf, pad(data));
  } else parts.push(pad(data));
  return Buffer.concat(parts);
}

/** A whole .xls file for sheets [{ name, rows }]. */
export const writeXls = (sheets, options) => compoundFile('Workbook', biffStream(sheets, options));
