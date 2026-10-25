// Asylum Claims: claims each year ending June, the queue awaiting an initial decision, the grant
// rate at initial decision, the top nationalities, and people on asylum support. Every sentence
// is built from public/data/features/asylum.json (Home Office immigration system statistics).

import { format } from 'd3';
import { $, startFeature } from './feature-page.js';
import { bars, el, emptyNote, formatCount, formatPercent, renderTable, roughly, tiles } from './charts.js';
import { createChart } from './line-chart.js';
import './styles/asylum.scss';

const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const lastIndex = (values) => {
  for (let i = values.length - 1; i >= 0; i -= 1) if (isNum(values[i])) return i;
  return -1;
};
const firstIndex = (values) => values.findIndex(isNum);
const yearDate = (y) => new Date(Date.UTC(y.year, 5, 30));
const keyDate = (d) => new Date(`${d.key}T00:00:00Z`);
const percentTick = format('.0%');
const WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
const numberWord = (n) => WORDS[n] ?? formatCount(n);

/**
 * "the fewest since X" / "the most since X": the latest earlier index whose value is at least as
 * low (or high) as values[i]; -1 when there is none (a record for the series).
 */
function sinceIndex(values, i, down) {
  for (let j = i - 1; j >= 0; j -= 1) {
    if (!isNum(values[j])) continue;
    if (down ? values[j] <= values[i] : values[j] >= values[i]) return j;
  }
  return -1;
}

/** Index of the largest (or smallest) value; ties go to the earliest. */
function extremeIndex(values, largest = true) {
  let best = -1;
  values.forEach((v, i) => {
    if (!isNum(v)) return;
    if (best < 0 || (largest ? v > values[best] : v < values[best])) best = i;
  });
  return best;
}

const yearLabel = (y) => (y.provisional ? `${y.label} (provisional)` : y.label);

startFeature('asylum', (data) => {
  const years = data.years ?? [];
  const claims = data.claims ?? {};
  const people = claims.people ?? [];
  const mainApplicants = claims.mainApplicants ?? [];
  const decisions = data.decisions ?? {};
  const awaiting = data.awaiting ?? {};
  const support = data.support ?? {};
  const nationalities = data.nationalities ?? [];

  // Grant rate shown only where grants plus refusals reach 100 (the plan's small-data guard).
  const decided = years.map((_, i) => {
    const parts = [decisions.protection?.[i], decisions.otherLeave?.[i], decisions.refused?.[i]];
    return parts.every(isNum) ? parts[0] + parts[1] + parts[2] : null;
  });
  const grantRate = years.map((_, i) => (isNum(decided[i]) && decided[i] >= 100 && isNum(decisions.grantRate?.[i]) ? decisions.grantRate[i] : null));

  const cLast = lastIndex(people);
  const aLast = lastIndex(awaiting.people ?? []);
  const rLast = lastIndex(grantRate);

  // Hero tiles.
  const heroTiles = [];
  if (cLast >= 0) heroTiles.push({ value: roughly(people[cLast]), label: `people claimed asylum, ${years[cLast].label}` });
  if (aLast >= 0) heroTiles.push({ value: roughly(awaiting.people[aLast]), label: `people awaiting an initial decision, ${awaiting.dates[aLast].label}` });
  if (rLast >= 0) heroTiles.push({ value: formatPercent(grantRate[rLast]), label: `of initial decisions were grants (main applicants), ${years[rLast].label}` });
  $('hero-graphic').append(heroTiles.length ? tiles(heroTiles) : emptyNote());

  drawClaims(years, people, mainApplicants, cLast);
  drawQueue(awaiting, aLast);
  drawRate(years, decisions, grantRate, rLast);
  drawNationalities(nationalities, years.at(-1));
  drawSupport(support);
});

function drawClaims(years, people, mainApplicants, last) {
  const pFirst = firstIndex(people);
  if (pFirst > 0) $('claims-people-start').textContent = `, in the ${years[pFirst].label}`;
  const provisional = years.filter((y) => y.provisional).map((y) => y.label);
  if (provisional.length) $('claims-provisional').textContent = ` Figures for the ${provisional.join(' and the ')} are provisional.`;

  if (last < 0) {
    $('claims-summary').textContent = 'No claims are recorded in this data.';
    $('claims-chart').append(emptyNote());
    $('claims-table').append(emptyNote());
    return;
  }

  const v = people[last];
  const y = years[last];
  const prev = last > 0 ? people[last - 1] : null;
  let sentence = `${roughly(v)} people claimed asylum in the UK in the ${y.label}`;
  let record = false;
  if (isNum(prev) && prev > 0 && prev !== v) {
    const down = v < prev;
    sentence += `, ${down ? 'down' : 'up'} ${formatPercent(Math.abs(v / prev - 1))} on the year before`;
    const j = sinceIndex(people, last, down);
    if (j >= 0) sentence += `, and the ${down ? 'fewest' : 'most'} since the ${years[j].label}`;
    else {
      sentence += `, the ${down ? 'fewest' : 'most'} in any year ending June since ${years[pFirst].year}`;
      record = !down;
    }
  }
  sentence += '.';
  const peak = extremeIndex(people);
  if (!record && peak >= 0 && peak !== last && peak > pFirst) {
    sentence += ` The most in any year ending June since ${years[pFirst].year} was ${roughly(people[peak])}, in the ${years[peak].label}.`;
  }
  $('claims-summary').textContent = sentence;

  const series = [{ id: 'people', label: 'People (main applicants and dependants)', values: people, style: 's6' }];
  if (mainApplicants.some(isNum)) series.push({ id: 'main', label: 'Main applicants', values: mainApplicants, style: 's1' });
  createChart($('claims-chart')).update({
    labels: years.map((yr) => yr.label),
    dates: years.map(yearDate),
    series,
    summary: `Line chart of people claiming asylum in the UK each year ending June, ${years[0].label.replace('year ending ', '')} to ${years.at(-1).label.replace('year ending ', '')}; ${roughly(v)} people in the ${y.label}.`,
  });
  $('claims-table').append(
    renderTable({
      caption: 'People claiming asylum in the UK, each year ending June',
      head: ['Year', 'People', 'Main applicants'],
      rows: years.map((yr, i) => [yearLabel(yr), people[i] ?? null, mainApplicants[i] ?? null]),
    }),
  );
}

const DURATIONS = [
  ['under3m', 'Under 3 months'],
  ['3to6m', '3 to 6 months'],
  ['6to12m', '6 to 12 months'],
  ['12mPlus', '12 months or more'],
];

function drawQueue(awaiting, last) {
  const dates = awaiting.dates ?? [];
  const people = awaiting.people ?? [];
  const cases = awaiting.cases ?? [];
  if (last < 0) {
    $('awaiting-summary').textContent = 'No claims awaiting a decision are recorded in this data.';
    for (const id of ['awaiting-chart', 'awaiting-table', 'duration-chart']) $(id).append(emptyNote());
    return;
  }

  const v = people[last];
  const caseText = isNum(cases[last]) ? ` (${roughly(cases[last])} cases)` : '';
  let sentence = `${roughly(v)} people${caseText} were waiting for an initial decision on ${dates[last].label}`;
  const peak = extremeIndex(people);
  if (peak === last) sentence += `, the most since this series begins on ${dates[firstIndex(people)].label}.`;
  else sentence += `, ${formatPercent(1 - v / people[peak])} lower than the peak of ${roughly(people[peak])} on ${dates[peak].label}.`;

  const by = awaiting.byDuration ?? {};
  const latest = DURATIONS.map(([key, label]) => ({ key, label, value: by[key]?.[last] ?? null }));
  const durationTotal = latest.every((d) => isNum(d.value)) ? latest.reduce((s, d) => s + d.value, 0) : null;
  if (isNum(durationTotal) && durationTotal >= 100) {
    const share = (key) => latest.find((d) => d.key === key).value / durationTotal;
    sentence += ` Of those people, ${formatPercent(share('under3m'))} had waited less than three months and ${formatPercent(share('12mPlus'))} a year or more.`;
  }
  $('awaiting-summary').textContent = sentence;

  const series = [{ id: 'people', label: 'People', values: people, style: 's6' }];
  if (cases.some(isNum)) series.push({ id: 'cases', label: 'Cases (main applicants)', values: cases, style: 's1' });
  createChart($('awaiting-chart')).update({
    labels: dates.map((d) => d.label),
    dates: dates.map(keyDate),
    series,
    summary: `Line chart of people awaiting an initial decision on an asylum claim in the UK at each quarter end, ${dates[0].label} to ${dates.at(-1).label}; ${roughly(v)} on ${dates[last].label}.`,
  });
  $('awaiting-table').append(
    renderTable({
      caption: 'Awaiting an initial decision, at each quarter end',
      head: ['Date', 'People', 'Cases'],
      rows: dates.map((d, i) => [d.label, people[i] ?? null, cases[i] ?? null]),
    }),
  );

  $('duration-title').textContent = `How long they had waited, ${dates[last].label}`;
  if (isNum(durationTotal) && durationTotal > 0) {
    const max = Math.max(...latest.map((d) => d.value));
    $('duration-chart').append(bars(latest.map((d) => ({ label: d.label, value: d.value })), max));
    $('duration-table').append(
      renderTable({
        caption: `People awaiting an initial decision by time waited, ${dates[last].label}`,
        head: ['Time waited', 'People', 'Share'],
        rows: latest.map((d) => [d.label, d.value, formatPercent(d.value / durationTotal)]),
      }),
    );
  } else {
    $('duration-chart').append(emptyNote());
  }
}

function drawRate(years, decisions, grantRate, last) {
  if (last < 0) {
    $('rate-summary').textContent = 'There are too few initial decisions in this data to give a grant rate.';
    $('rate-chart').append(emptyNote());
    $('rate-table').append(emptyNote());
    return;
  }
  const rate = grantRate[last];
  const label = years[last].label;
  let sentence = `${formatPercent(rate)} of initial decisions on asylum claims (main applicants) in the ${label} were grants of protection or other leave`;
  const prev = last > 0 ? grantRate[last - 1] : null;
  if (isNum(prev)) {
    if (formatPercent(prev) === formatPercent(rate)) sentence += `, the same as a year earlier`;
    else sentence += `, ${rate > prev ? 'up' : 'down'} from ${formatPercent(prev)} a year earlier`;
  }
  sentence += '.';
  const first = firstIndex(grantRate);
  const lo = extremeIndex(grantRate, false);
  const hi = extremeIndex(grantRate, true);
  if (first >= 0 && lo !== hi && last - first >= 2) {
    sentence += ` Since the ${years[first].label}, it has ranged from ${formatPercent(grantRate[lo])} (${years[lo].label}) to ${formatPercent(grantRate[hi])} (${years[hi].label}).`;
  }
  $('rate-summary').textContent = sentence;

  createChart($('rate-chart'), { formatValue: (v) => (v === null ? 'Not shown' : formatPercent(v)), formatTick: percentTick }).update({
    labels: years.map((y) => y.label),
    dates: years.map(yearDate),
    series: [{ id: 'rate', label: 'Grant rate (main applicants)', values: grantRate, style: 's6' }],
    summary: `Line chart of the asylum grant rate at initial decision in the UK each year ending June, ${years[first].label.replace('year ending ', '')} to ${years[last].label.replace('year ending ', '')}; ${formatPercent(rate)} in the ${label}.`,
  });
  const grants = years.map((_, i) => (isNum(decisions.protection?.[i]) && isNum(decisions.otherLeave?.[i]) ? decisions.protection[i] + decisions.otherLeave[i] : null));
  $('rate-table').append(
    renderTable({
      caption: 'Initial decisions on main applicants, each year ending June',
      head: ['Year', 'Grants', 'Refusals', 'Withdrawals', 'Grant rate'],
      rows: years.map((y, i) => [
        yearLabel(y),
        grants[i],
        decisions.refused?.[i] ?? null,
        decisions.withdrawn?.[i] ?? null,
        isNum(grantRate[i]) ? formatPercent(grantRate[i]) : 'not shown',
      ]),
    }),
  );
}

function drawNationalities(list, latestYear) {
  const rows = list.filter((n) => isNum(n.claims));
  if (!rows.length) {
    $('nationality-chart').append(emptyNote());
    return;
  }
  const label = latestYear?.label ?? 'latest year';
  const top = rows[0];
  let sentence = `The most common nationality claiming asylum in the ${label} was ${top.name} (${roughly(top.claims)} people).`;
  const rates = rows.map((n) => n.grantRate).filter(isNum);
  if (rows.length >= 3 && rates.length >= 2 && Math.min(...rates) !== Math.max(...rates)) {
    sentence += ` Among the ${numberWord(rows.length)} most common nationalities, grant rates at initial decision ranged from ${formatPercent(Math.min(...rates))} to ${formatPercent(Math.max(...rates))}.`;
  }
  $('nationality-summary').textContent = sentence;
  $('nationality-chart-title').textContent = `People claiming asylum, by nationality, ${label}`;

  const rateText = (n) => (isNum(n.grantRate) ? `grant rate ${formatPercent(n.grantRate)}` : 'too few decisions for a grant rate');
  const listNode = bars(
    rows.map((n) => ({ label: n.name, value: n.claims })),
    Math.max(...rows.map((n) => n.claims)),
  );
  [...listNode.children].forEach((li, i) => {
    li.querySelector('.mag-bar__name').append(el('span', 'mag-asylum-rate', rateText(rows[i])));
  });
  $('nationality-chart').append(listNode);
  $('nationality-table').append(
    renderTable({
      caption: `Top nationalities claiming asylum, ${label}`,
      head: ['Nationality', 'People claiming', 'Decisions (main applicants)', 'Grant rate'],
      rows: rows.map((n) => [n.name, n.claims, n.decisions ?? null, isNum(n.grantRate) ? formatPercent(n.grantRate) : 'too few decisions']),
    }),
  );
}

function drawSupport(support) {
  const dates = support.dates ?? [];
  const people = support.people ?? [];
  const hotels = support.hotels ?? [];
  const last = lastIndex(people);
  const hFirst = firstIndex(hotels);
  if (hFirst >= 0) $('support-hotel-start').textContent = `, recorded from ${dates[hFirst].label}`;
  if (last < 0) {
    $('support-summary').textContent = 'No asylum support figures are recorded in this data.';
    $('support-chart').append(emptyNote());
    $('support-table').append(emptyNote());
    return;
  }

  const v = people[last];
  const h = hotels[last];
  let sentence = `${roughly(v)} people were receiving asylum support on ${dates[last].label}`;
  const back = last - 4;
  const prev = back >= 0 ? people[back] : null;
  if (isNum(prev) && prev > 0 && prev !== v) sentence += `, ${formatPercent(Math.abs(v / prev - 1))} ${v < prev ? 'fewer' : 'more'} than a year earlier`;
  sentence += '.';
  if (isNum(h) && v > 0) {
    if (h === 0) sentence += ' None of them were in hotels.';
    else {
      sentence += ` ${roughly(h)} (${formatPercent(h / v)}) of them were in hotels`;
      const hPrev = back >= 0 ? hotels[back] : null;
      if (isNum(hPrev) && hPrev > 0 && hPrev !== h) sentence += `, ${h < hPrev ? 'down' : 'up'} ${formatPercent(Math.abs(h / hPrev - 1))} on a year earlier`;
      sentence += '.';
    }
  }
  $('support-summary').textContent = sentence;

  const series = [{ id: 'people', label: 'All people on support', values: people, style: 's1' }];
  if (hFirst >= 0) series.push({ id: 'hotels', label: 'In hotels', values: hotels, style: 's6' });
  createChart($('support-chart')).update({
    labels: dates.map((d) => d.label),
    dates: dates.map(keyDate),
    series,
    summary: `Line chart of people receiving asylum support in the UK at each quarter end, ${dates[0].label} to ${dates.at(-1).label}, with the number in hotels; ${roughly(v)} people on ${dates[last].label}.`,
  });
  $('support-table').append(
    renderTable({
      caption: 'People receiving asylum support, at each quarter end',
      head: ['Date', 'All people', 'In hotels'],
      rows: dates.map((d, i) => [d.label, people[i] ?? null, isNum(hotels[i]) ? hotels[i] : 'not recorded']),
    }),
  );
}
