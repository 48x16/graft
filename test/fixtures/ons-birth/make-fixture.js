// Builds test/fixtures/ons-birth/emp06aug2026.xls: a tiny copy of ONS EMP06 (August 2026
// edition) with the same sheet names, header rows (title, publication date, units, stacked
// header, CDIDs on row 10) and footnote-glued quarter labels, but only 7 data columns and 11
// quarters. Values are real except the deliberate awkward cases:
//   - Country of birth rates, Apr-Jun 1997, Total EU: "*" (suppressed: sample too small);
//   - Country of birth levels, Apr-Jun 2020, Total Non UK: ".." (not available);
//   - Country of birth levels, Apr-Jun 2024, the duplicate Total EU (column G): ".."
//     (proves that column D is the one read);
//   - no Apr-Jun 2010 row, only Jul-Sep 2010 (a year without the latest quarter).
// Cells use the record types the real file uses: SST strings, MULRK/RK integers, NUMBER
// decimals, one FORMULA with a cached number and one LABEL.
//
//   node test/fixtures/ons-birth/make-fixture.js

import { writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeXls } from './write-xls.js';

const HERE = dirname(fileURLToPath(import.meta.url));

const LABELS = ['Jan-Mar 1997', 'Apr-Jun 1997', 'Apr-Jun 2008', 'Jul-Sep 2010', 'Apr-Jun 2016', 'Jan-Mar 20197', 'Apr-Jun 2019', 'Apr-Jun 20208', 'Apr-Jun 2024', 'Jan-Mar 2026', 'Apr-Jun 2026'];

const COB_LEVELS = [
  [26244686, 24322682, 1920949, 638222, 1282727, 693914, 638222],
  [26444241, 24467891, 1975138, 651940, 1323198, 714891, 651940],
  [29637062, 25878810, 3755932, 1297869, 2458063, 1454993, 1297869],
  [29483800, 25536507, 3944089, 1388985, 2555104, 1504284, 1388985],
  [31672719, 26260789, 5406045, 2334727, 3071318, 2530971, 2334727],
  [32769735, 26945969, 5817229, 2431564, 3385665, 2674426, 2431564],
  [32883950, 27083034, 5793186, 2447105, 3346081, 2701246, 2447105],
  [32553002, 26852104, '..', 2342460, 3343662, '..', 2342460],
  [33416689, 26514065, 6902204, 2237380, 4664824, '..', '..'],
  [34369367, 26668623, 7697782, 2400259, 5297523, '..', 2400259],
  [34426383, 26760770, 7662069, 2275380, 5386689, '..', 2275380],
];
const COB_RATES = [
  [70.401265, 71.263537, 61.062884, 64.742004, 59.408774, 63.586046, 64.742004],
  [70.825526, 71.666639, 61.859625, '*', 59.776514, 65.287546, '*'],
  [72.681836, 73.433559, 67.971003, 78.074429, 63.615806, 75.28377, 78.074429],
  [70.962918, 71.541, 67.61688, 75.706617, 63.893901, 74.189872, 75.706617],
  [74.243752, 74.747775, 72.193246, 79.402277, 67.484455, 78.204858, 79.402277],
  [75.88717, 76.233544, 74.493355, 82.768353, 69.489347, 81.67075, 82.768353],
  [75.885088, 76.233926, 74.439178, 82.995655, 69.148512, 82.084021, 82.995655],
  [75.214759, 75.242479, 75.322431, 81.193975, 71.62571, '..', 81.193975],
  [74.387723, 74.345989, 74.661639, 79.506383, 72.531477, '..', 79.506383],
  [74.948682, 74.361539, 77.187636, 80.1377, 75.906874, '..', 80.1377],
  [{ formula: 74.984302 }, 74.598311, 76.511864, 80.873406, 74.79424, '..', 80.873406],
];
const NAT_LEVELS = [
  [26244686, 25315606, 927858, 437353, 490505, 478618, 437353],
  [26444241, 25477531, 965880, 441421, 524459, 492517, 441421],
  [29637062, 27320851, 2312265, 1110587, 1201678, 1198732, 1110587],
  [29483800, 27059637, 2421534, 1232000, 1189534, 1295457, 1232000],
  [31672719, 28227756, 3442179, 2234082, 1208097, 2299424, 2234082],
  [32769735, 29056168, 3713070, 2394564, 1318506, 2521616, 2394564],
  [32883950, 29202702, 3674573, 2379810, 1294763, 2501653, 2379810],
  [32553002, 28947624, 3588927, 2242021, 1346906, '..', 2242021],
  [33416689, 28886013, 4528020, 2141341, 2386679, '..', 2141341],
  [34369367, 29277424, 5091037, 2280919, 2810118, '..', 2280919],
  [34426383, 29399404, 5026556, 2156340, 2870216, '..', 2156340],
];
const NAT_RATES = [
  [70.401265, 70.937433, 58.441269, 64.299557, 54.089903, 62.710667, 64.299557],
  [70.825526, 71.3549, 59.327101, 64.695915, 55.482585, 63.225061, 64.695915],
  [72.681836, 73.092847, 68.313996, 78.140352, 61.228469, 75.516233, 78.140352],
  [70.962918, 71.256998, 68.111381, 76.119332, 61.413522, 74.947417, 76.119332],
  [74.243752, 74.552667, 72.255387, 78.437552, 63.054624, 77.617558, 78.437552],
  [75.88717, 76.012367, 75.163175, 82.658915, 64.53919, 82.046326, 82.658915],
  [75.885088, 76.052369, 74.824464, 83.16897, 63.161958, 82.381474, 83.16897],
  [75.214759, 75.237562, 75.385616, 81.470527, 67.049045, '..', 81.470527],
  [74.387723, 74.495671, 73.936441, 79.220877, 69.785948, '..', 79.220877],
  [74.948682, 74.837716, 75.836364, 78.740352, 73.633959, '..', 78.740352],
  [74.984302, 74.999527, 75.134902, 80.378469, 71.665799, '..', 80.378469],
];

const FOOTNOTES = (who) => [
  '1. The total series includes people who do not state their country of birth or nationality. The total levels series MGTM does not therefore equal the sum of the "UK" and "Non-UK" series.',
  '2. This series consists of all 27 EU member states.',
  '7. Data from January to March 2019 onward has been reweighted, causing a step change discontinuity.',
  `8. Non-response from individuals with a non-UK ${who} increased during the coronavirus (COVID-19) pandemic. We advise extreme caution when using estimates between 2020 and 2022. See Important Note 1 for more information.`,
  '',
  'The estimates shown in this table relate to the number of people in employment and should not be used as a proxy for flows of foreign migrants into the UK.',
];

function dataSheet(name, title, units, cdids, values, who, { labelCell = false } = {}) {
  const rows = [
    [title],
    ['Date of publication:', 46252],
    [],
    [],
    [units],
    [],
    ['', '', 'UK', 'Non-UK', '', '', 'Europe'],
    ['', '', '', '', '', '', '', 'European Union (EU)'],
    [],
    ['', 'Total1', 'UK', 'Total\nNon UK', 'Total EU (EU27)2', 'Total\nnon-EU', 'Total\nEurope', 'Total EU (EU27)2'],
    [labelCell ? { label: 'Dataset identifier code' } : 'Dataset identifier code', ...cdids],
    [],
    ...LABELS.map((label, i) => [label, ...values[i]]),
    [],
    ...FOOTNOTES(who).map((f) => [f]),
  ];
  return { name, rows };
}

const LEVELS = 'People aged 16 and over (not seasonally adjusted)';
const RATES = 'People aged 16 to 64 (not seasonally adjusted)';
const sheets = [
  { name: 'Note', rows: [['IMPORTANT NOTE 1:'], ['These are official statistics.']] },
  { name: 'Introduction', rows: [['EMP06 Employment by country of birth and nationality'], [], [], ['Inquiries: Email: ', 'labour.market@ons.gov.uk']] },
  dataSheet('Country of birth levels', `Table EMP06: Employment levels by country of birth: ${LEVELS}`, 'United Kingdom (thousands) not seasonally adjusted', ['MGTM', 'JF6F', 'JF6G', 'EQ4Q', 'EQ4S', 'FSC2', 'EQ4Q'], COB_LEVELS, 'country of birth'),
  dataSheet('Country of birth rates', `Table EMP06: Employment rates by country of birth: ${RATES}`, 'United Kingdom (%) not seasonally adjusted', ['LF9D', 'LFM6', 'LFM7', 'EQ4Y', 'EQ52', 'FSD5', 'EQ4Y'], COB_RATES, 'country of birth'),
  dataSheet('Nationality Levels', `Table EMP06: Employment levels by nationality: ${LEVELS}`, 'United Kingdom (thousands) not seasonally adjusted', ['MGTM', 'JF6H', 'JF6I', 'EQ4U', 'EQ4W', 'FSC8', 'EQ4U'], NAT_LEVELS, 'nationality'),
  dataSheet('Nationality rates', `Table EMP06: Employment rates by nationality: ${RATES}`, 'United Kingdom (%) not seasonally adjusted', ['LF9D', 'LFN8', 'LFN9', 'EQ54', 'EQ56', 'FSE3', 'EQ54'], NAT_RATES, 'nationality', { labelCell: true }),
];

const out = join(HERE, 'emp06aug2026.xls');
await writeFile(out, writeXls(sheets));
console.log(`wrote ${out}`);
