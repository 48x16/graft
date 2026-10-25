// Runs the data sources in pipeline/sources/, each writing its own JSON to public/data/.
//
//   node pipeline/run.js                  every source: download into .cache/, then build
//   node pipeline/run.js --cached         every source, from .cache/ (offline)
//   node pipeline/run.js --fixture        every source, from test/fixtures/ (tiny, as the tests use)
//   node pipeline/run.js <name> [--cached|--fixture]   one source
//
// A source is a module exporting `run(mode)`. Nothing here wipes public/data/, so sources can
// run in any order. One failing source fails the run, and says which.

import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { modeOf, ROOT } from './lib/util.js';

const mode = modeOf();
const only = process.argv.slice(2).find((a) => !a.startsWith('--'));
const dir = join(ROOT, 'pipeline', 'sources');
const names = (await readdir(dir)).filter((f) => f.endsWith('.js')).map((f) => f.slice(0, -3)).sort();
if (only && !names.includes(only)) {
  console.error(`No source called "${only}". There are: ${names.join(', ')}`);
  process.exit(2);
}

let failed = false;
for (const name of only ? [only] : names) {
  const started = Date.now();
  try {
    const source = await import(pathToFileURL(join(dir, `${name}.js`)).href);
    const result = await source.run(mode);
    console.log(`${name}: ${result ?? 'done'} (${((Date.now() - started) / 1000).toFixed(1)}s)`);
  } catch (err) {
    failed = true;
    console.error(`${name}: FAILED\n${err.stack ?? err}`);
  }
}
process.exitCode = failed ? 1 : 0;
