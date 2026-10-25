// Example source: made-up applications and grants, from a small CSV. Builds
// public/data/features/example.json for example.html. Delete it once a real source exists.
//
// A real source follows the same shape:
// - a header comment: what it builds, the publisher, the tables, the licence, how often it updates;
// - `run(mode)`: in 'download' mode fetch into .cache/<name>/ first, then read from inputDir();
// - pure exported functions (`buildExample(rows)`) doing the work, which the tests import;
// - validation that throws if the headers or codes change, so a changed table fails loudly.

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parse } from 'csv-parse/sync';
import { expectColumns, inputDir, num, writeJson } from '../lib/util.js';

const NAME = 'example';

/** Rows of { year, group, region, applications, grants } → the page's data. */
export function buildExample(rows) {
  if (rows.length === 0) throw new Error('example: no rows');
  expectColumns(rows[0], ['year', 'group', 'region', 'applications', 'grants'], 'example');
  const years = [...new Set(rows.map((r) => Number(r.year)))].sort((a, b) => a - b);
  const sum = (filter, key) => years.map((y) => rows.filter((r) => Number(r.year) === y && filter(r)).reduce((s, r) => s + (num(r[key]) ?? 0), 0));
  const all = () => true;
  const groupNames = [...new Set(rows.map((r) => r.group))];
  const share = (g, i) => {
    const apps = sum((r) => r.group === g, 'applications')[i];
    return apps ? sum((r) => r.group === g, 'grants')[i] / apps : null;
  };
  const last = years.length - 1;
  return {
    updated: String(years[last]),
    years,
    applications: sum(all, 'applications'),
    grants: sum(all, 'grants'),
    groups: groupNames.map((g) => ({ name: g, share: share(g, last), before: last > 0 ? share(g, last - 1) : null })).filter((g) => g.share !== null),
    regions: [...new Set(rows.map((r) => r.region))].map((name) => ({ name, values: sum((r) => r.region === name, 'applications') })),
  };
}

export async function run(mode) {
  // The example has no download: both modes read the fixture.
  const file = join(inputDir(NAME, 'fixture'), 'example.csv');
  const rows = parse(await readFile(file, 'utf8'), { columns: true, skip_empty_lines: true });
  const data = buildExample(rows);
  await writeJson(`features/${NAME}.json`, data);
  return `${data.years.length} years (${mode})`;
}
