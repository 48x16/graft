// Reads sheets of an old binary Excel workbook (.xls, BIFF8) as rows of strings, like xlsx.js
// and ods.js. Some ONS datasets (EMP06, A12) are still published this way.
//
// An .xls file is a Compound File (a small FAT file system in one file) holding a "Workbook"
// stream of BIFF records. We read only what plain data tables need: the sheet list
// (BOUNDSHEET), the shared strings (SST, with its CONTINUE records), and the cell records
// LABELSST, LABEL, NUMBER, RK, MULRK, BOOLERR and FORMULA (its cached result, or the STRING
// record after it). No styles, number formats, merged cells or formulas themselves: numbers
// come out as plain decimal strings (a date is its serial number, as in xlsx.js).

import { readFile } from 'node:fs/promises';

const SIGNATURE = 'd0cf11e0a1b11ae1';
const END_OF_CHAIN = 0xfffffffe;
const FREE = 0xffffffff;
const MAX_SECTORS = 1 << 22; // guards chain walking against loops in a damaged file

// ---------------------------------------------------------------------------------------------
// Compound File

/** Follows a sector chain through a FAT, from `start`. Throws on a loop or a bad sector. */
function chain(fat, start, what) {
  const out = [];
  const seen = new Set();
  for (let s = start; s !== END_OF_CHAIN; s = fat[s]) {
    if (s === FREE || s >= fat.length || seen.has(s) || out.length > MAX_SECTORS) throw new Error(`xls: broken sector chain in ${what}`);
    seen.add(s);
    out.push(s);
  }
  return out;
}

/**
 * Opens a Compound File held in `buf` and returns its streams by name (top-level and nested,
 * names as stored) as a Map of name → Buffer.
 */
export function readCompoundFile(buf) {
  if (buf.length < 512 || buf.subarray(0, 8).toString('hex') !== SIGNATURE) throw new Error('xls: not an old-style Excel file (no Compound File signature)');
  const sectorSize = 1 << buf.readUInt16LE(0x1e);
  const miniSize = 1 << buf.readUInt16LE(0x20);
  const fatCount = buf.readUInt32LE(0x2c);
  const firstDir = buf.readUInt32LE(0x30);
  const cutoff = buf.readUInt32LE(0x38);
  const firstMiniFat = buf.readUInt32LE(0x3c);
  let difatNext = buf.readUInt32LE(0x44);
  const sector = (n) => {
    const at = (n + 1) * sectorSize;
    if (at >= buf.length) throw new Error('xls: sector beyond the end of the file');
    return buf.subarray(at, Math.min(at + sectorSize, buf.length));
  };

  // The FAT's own sectors: 109 listed in the header, the rest in a chain of DIFAT sectors.
  const fatSectors = [];
  for (let i = 0; i < 109 && fatSectors.length < fatCount; i++) fatSectors.push(buf.readUInt32LE(0x4c + i * 4));
  const perSector = sectorSize / 4;
  for (let guard = 0; fatSectors.length < fatCount && difatNext !== END_OF_CHAIN && difatNext !== FREE; guard++) {
    if (guard > MAX_SECTORS) throw new Error('xls: broken DIFAT chain');
    const d = sector(difatNext);
    for (let i = 0; i < perSector - 1 && fatSectors.length < fatCount; i++) fatSectors.push(d.readUInt32LE(i * 4));
    difatNext = d.readUInt32LE((perSector - 1) * 4);
  }
  const fat = [];
  for (const s of fatSectors) {
    const d = sector(s);
    for (let i = 0; i + 4 <= d.length; i += 4) fat.push(d.readUInt32LE(i));
  }
  const readChain = (start, what) => Buffer.concat(chain(fat, start, what).map(sector));

  // Directory: 128-byte entries. Type 1 = storage, 2 = stream, 5 = root (owns the mini stream).
  const dir = readChain(firstDir, 'the directory');
  const entries = [];
  for (let at = 0; at + 128 <= dir.length; at += 128) {
    const nameLen = dir.readUInt16LE(at + 0x40);
    entries.push({
      name: dir.toString('utf16le', at, at + Math.max(0, nameLen - 2)),
      type: dir[at + 0x42],
      start: dir.readUInt32LE(at + 0x74),
      size: dir.readUInt32LE(at + 0x78), // the high 32 bits are 0 for any workbook we will meet
    });
  }
  const root = entries[0];
  if (!root || root.type !== 5) throw new Error('xls: no root entry in the Compound File');

  // Streams under the cutoff (4096 bytes) live in 64-byte mini sectors inside the root's stream.
  let miniFat = null;
  let miniStream = null;
  const mini = () => {
    if (!miniFat) {
      miniFat = [];
      if (firstMiniFat !== END_OF_CHAIN && firstMiniFat !== FREE) {
        const d = readChain(firstMiniFat, 'the mini FAT');
        for (let i = 0; i + 4 <= d.length; i += 4) miniFat.push(d.readUInt32LE(i));
      }
      miniStream = root.start === END_OF_CHAIN ? Buffer.alloc(0) : readChain(root.start, 'the mini stream');
    }
    return { miniFat, miniStream };
  };

  const streams = new Map();
  for (const e of entries.slice(1)) {
    if (e.type !== 2) continue;
    let data;
    if (e.size === 0) data = Buffer.alloc(0);
    else if (e.size < cutoff) {
      const m = mini();
      data = Buffer.concat(chain(m.miniFat, e.start, e.name).map((s) => m.miniStream.subarray(s * miniSize, (s + 1) * miniSize)));
    } else data = readChain(e.start, e.name);
    if (data.length < e.size) throw new Error(`xls: stream "${e.name}" is shorter than its directory entry says`);
    streams.set(e.name, data.subarray(0, e.size));
  }
  return streams;
}

// ---------------------------------------------------------------------------------------------
// BIFF8 records

const R = {
  FORMULA: 0x0006,
  EOF: 0x000a,
  CONTINUE: 0x003c,
  BOUNDSHEET: 0x0085,
  MULRK: 0x00bd,
  SST: 0x00fc,
  LABELSST: 0x00fd,
  NUMBER: 0x0203,
  LABEL: 0x0204,
  BOOLERR: 0x0205,
  STRING: 0x0207,
  RK: 0x027e,
  BOF: 0x0809,
};

const ERRORS = { 0x00: '#NULL!', 0x07: '#DIV/0!', 0x0f: '#VALUE!', 0x17: '#REF!', 0x1d: '#NAME?', 0x24: '#NUM!', 0x2a: '#N/A' };

/** Every record in a BIFF stream from `start`: { type, data, offset }. Stops at the end. */
function* records(stream, start = 0) {
  let at = start;
  while (at + 4 <= stream.length) {
    const type = stream.readUInt16LE(at);
    const len = stream.readUInt16LE(at + 2);
    if (at + 4 + len > stream.length) throw new Error(`xls: record 0x${type.toString(16)} runs past the end of the stream`);
    yield { type, data: stream.subarray(at + 4, at + 4 + len), offset: at };
    at += 4 + len;
  }
}

/** An RK number: a 30-bit integer or the top 30 bits of a double, optionally ÷ 100. */
export function decodeRk(rk) {
  let v;
  if (rk & 0x02) v = rk >> 2; // signed shift: negative integers stay negative
  else {
    const b = Buffer.alloc(8);
    b.writeUInt32LE((rk & 0xfffffffc) >>> 0, 4);
    v = b.readDoubleLE(0);
  }
  return rk & 0x01 ? v / 100 : v;
}

/** Decimal text for a cell number: 34426383 → "34426383", 74.6 → "74.6". */
const numText = (v) => (Number.isFinite(v) ? String(v) : '');

/** Characters stored one byte each (fHighByte 0) are Latin-1; two bytes each, UTF-16LE. */
const chars = (data, at, count, high) => (high ? data.toString('utf16le', at, at + count * 2) : data.toString('latin1', at, at + count));

/** An XLUnicodeString inside one record (LABEL, STRING, BOUNDSHEET with an 8-bit count). */
function unicodeString(data, at, countBytes = 2) {
  const count = countBytes === 1 ? data[at] : data.readUInt16LE(at);
  const flags = data[at + countBytes];
  return chars(data, at + countBytes + 1, count, flags & 0x01);
}

/**
 * The shared string table, from the SST record's data and its CONTINUE records' data. A string
 * can break across records anywhere; where its characters break, the next record starts with a
 * fresh flags byte saying whether the rest is one or two bytes per character.
 */
export function parseSst(parts) {
  let p = 0;
  let at = 0;
  const next = () => {
    p++;
    at = 0;
    if (p >= parts.length) throw new Error('xls: shared string table ends early');
  };
  const ensure = () => {
    while (at >= parts[p].length) next();
  };
  const u8 = () => {
    ensure();
    return parts[p][at++];
  };
  const u16 = () => u8() | (u8() << 8);
  const u32 = () => (u16() | (u16() << 16)) >>> 0;
  const skip = (n) => {
    while (n > 0) {
      ensure();
      const take = Math.min(n, parts[p].length - at);
      at += take;
      n -= take;
    }
  };

  if (!parts.length || parts[0].length < 8) return [];
  u32(); // total references
  const unique = u32();
  const out = [];
  for (let i = 0; i < unique; i++) {
    const count = u16();
    const flags = u8();
    let high = flags & 0x01;
    const runs = flags & 0x08 ? u16() : 0;
    const ext = flags & 0x04 ? u32() : 0;
    let s = '';
    let left = count;
    while (left > 0) {
      if (at >= parts[p].length) {
        next();
        high = parts[p][at++] & 0x01; // the flags byte at the start of a CONTINUE
      }
      const fit = Math.min(left, Math.floor((parts[p].length - at) / (high ? 2 : 1)));
      if (fit === 0) throw new Error('xls: a shared string breaks inside a character');
      s += chars(parts[p], at, fit, high);
      at += fit * (high ? 2 : 1);
      left -= fit;
    }
    skip(runs * 4 + ext); // formatting runs and phonetic data: not needed
    out.push(s);
  }
  return out;
}

/** The workbook globals: sheet names with where each sheet's records start, and the SST. */
function readGlobals(stream) {
  const sheets = [];
  const sstParts = [];
  let inSst = false;
  let first = true;
  for (const { type, data } of records(stream)) {
    if (first) {
      if (type !== R.BOF) throw new Error('xls: the Workbook stream does not start with a BOF record');
      const version = data.readUInt16LE(0);
      if (version !== 0x0600) throw new Error(`xls: only Excel 97-2003 (BIFF8) files are supported, not BIFF version 0x${version.toString(16)}`);
      first = false;
      continue;
    }
    if (type === R.CONTINUE && inSst) {
      sstParts.push(data);
      continue;
    }
    inSst = false;
    if (type === R.BOUNDSHEET) {
      // Type 0 = worksheet (2 = chart, 6 = VB module): only worksheets hold cells.
      sheets.push({ name: unicodeString(data, 6, 1), offset: data.readUInt32LE(0), kind: data[5] });
    } else if (type === R.SST) {
      sstParts.push(data);
      inSst = true;
    } else if (type === R.EOF) break;
  }
  return { sheets: sheets.filter((s) => s.kind === 0), sst: parseSst(sstParts) };
}

/** The rows of the sheet whose BOF record is at `offset`. Gaps are '' and trailing ones dropped. */
export function readSheetAt(stream, offset, sst) {
  const rows = [];
  const put = (r, c, v) => {
    while (rows.length <= r) rows.push([]);
    const row = rows[r];
    while (row.length < c) row.push('');
    row[c] = v;
  };
  let formulaCell = null; // a FORMULA whose result is a string comes with a STRING record next
  let first = true;
  for (const { type, data } of records(stream, offset)) {
    if (first) {
      if (type !== R.BOF) throw new Error('xls: a sheet does not start with a BOF record');
      first = false;
      continue;
    }
    if (type === R.EOF) break;
    if (type === R.STRING && formulaCell) {
      put(formulaCell.r, formulaCell.c, unicodeString(data, 0));
      formulaCell = null;
      continue;
    }
    formulaCell = null;
    if (type === R.LABELSST) {
      const i = data.readUInt32LE(6);
      if (i >= sst.length) throw new Error(`xls: a cell points to shared string ${i} of ${sst.length}`);
      put(data.readUInt16LE(0), data.readUInt16LE(2), sst[i]);
    } else if (type === R.LABEL) put(data.readUInt16LE(0), data.readUInt16LE(2), unicodeString(data, 6));
    else if (type === R.NUMBER) put(data.readUInt16LE(0), data.readUInt16LE(2), numText(data.readDoubleLE(6)));
    else if (type === R.RK) put(data.readUInt16LE(0), data.readUInt16LE(2), numText(decodeRk(data.readUInt32LE(6))));
    else if (type === R.MULRK) {
      const r = data.readUInt16LE(0);
      const c0 = data.readUInt16LE(2);
      const n = (data.length - 6) / 6;
      for (let k = 0; k < n; k++) put(r, c0 + k, numText(decodeRk(data.readUInt32LE(4 + k * 6 + 2))));
    } else if (type === R.BOOLERR) {
      const v = data[6];
      put(data.readUInt16LE(0), data.readUInt16LE(2), data[7] ? (ERRORS[v] ?? '#ERROR') : v ? 'TRUE' : 'FALSE');
    } else if (type === R.FORMULA) {
      const r = data.readUInt16LE(0);
      const c = data.readUInt16LE(2);
      if (data.readUInt16LE(12) !== 0xffff) put(r, c, numText(data.readDoubleLE(6)));
      else if (data[6] === 0) formulaCell = { r, c }; // string: value in the next STRING record
      else if (data[6] === 1) put(r, c, data[8] ? 'TRUE' : 'FALSE');
      else if (data[6] === 2) put(r, c, ERRORS[data[8]] ?? '#ERROR');
      // 3: empty string, leave the cell blank
    }
  }
  while (rows.length && rows.at(-1).every((v) => v === '')) rows.pop();
  return rows;
}

/** Opens .xls bytes: `names` lists the worksheets in order, and `sheet(name)` reads one. */
export function openWorkbook(buf, label = 'workbook') {
  const streams = readCompoundFile(buf);
  const stream = streams.get('Workbook') ?? streams.get('Book');
  if (!stream) throw new Error(`${label}: no Workbook stream (is it an Excel file?)`);
  const { sheets, sst } = readGlobals(stream);
  return {
    names: sheets.map((s) => s.name),
    sheet(name) {
      const s = sheets.find((x) => x.name === name);
      if (!s) throw new Error(`${label}: no sheet named "${name}" (has ${sheets.map((x) => x.name).join(', ')})`);
      return readSheetAt(stream, s.offset, sst);
    },
  };
}

/** Opens an .xls file once, for reading several sheets (same shape as xlsx.js and ods.js). */
export async function readWorkbook(path) {
  return openWorkbook(await readFile(path), path);
}
