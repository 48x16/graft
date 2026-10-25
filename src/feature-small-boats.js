// Boats and Returns: small boat arrivals by month, people per boat, who arrives, asylum claims
// and returns from the UK. Every sentence is built from public/data/features/small-boats.json.

import { $, startFeature } from './feature-page.js';
import { bars, el, emptyNote, formatCount, formatPercent, heatTable, list, markedBars, renderTable, roughly, tiles } from './charts.js';
import { createChart } from './line-chart.js';
import './styles/small-boats.scss';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const NUMBER_WORDS = ['no', 'one', 'two', 'three', 'four', 'five'];
const MIN_BASE = 100; // shares and changes need at least this many in the base
const MIN_BOATS = 10; // people per boat needs at least this many boats

const oneDp = new Intl.NumberFormat('en-GB', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const formatOneDp = (v) => (v === null || v === undefined ? 'not published' : oneDp.format(v));
const known = (v) => v !== null && v !== undefined && Number.isFinite(v);
const sum = (values) => values.filter(known).reduce((a, b) => a + b, 0);

/** "up 12%" / "down 3%" / "unchanged", or null when the base is too small to say. */
function change(now, before) {
  if (!known(now) || !known(before) || before < MIN_BASE) return null;
  const c = now / before - 1;
  if (Math.abs(c) < 0.005) return 'unchanged';
  return `${c > 0 ? 'up' : 'down'} ${formatPercent(Math.abs(c))}`;
}

/** Right-aligns the cells of a rendered table whose figures were passed as text. */
function alignNumeric(node) {
  for (const td of node.querySelectorAll('td')) td.classList.add('govuk-table__cell--numeric');
  return node;
}

const withProvisional = (y) => (y.provisional ? `${y.label} (provisional)` : y.label);

startFeature('small-boats', (data) => {
  const { months, perBoat = [], years = [], arrivals = [], detections, nationalities = [], notRecorded, ageSex, claimed = [], returns, smallBoatReturns } = data;
  const last = years.length - 1;
  const latestLabel = years[last]?.label;
  const latestArrivals = arrivals[last];

  // ---------------------------------------------------------------- hero
  const heroTiles = [];
  if (known(latestArrivals)) heroTiles.push({ value: roughly(latestArrivals), label: `small boat arrivals, ${latestLabel}` });
  const detected = detections ? sum([detections.smallBoat, detections.air, detections.inCountry, detections.ports]) : 0;
  if (detected >= MIN_BASE && known(detections.smallBoat)) {
    heroTiles.push({ value: formatPercent(detections.smallBoat / detected), label: `of detected irregular arrivals came by small boat, ${latestLabel}` });
  }
  const perBoatShown = perBoat.filter((p) => known(p.perBoat) && p.boats >= MIN_BOATS);
  const latestBoat = perBoatShown.at(-1);
  if (latestBoat) heroTiles.push({ value: formatOneDp(latestBoat.perBoat), label: `people per boat on average, ${latestBoat.label}` });
  $('hero-graphic').append(heroTiles.length ? tiles(heroTiles) : emptyNote());

  // ---------------------------------------------------------------- by month
  const monthSentences = [];
  if (known(latestArrivals)) {
    const c = change(latestArrivals, arrivals[last - 1]);
    const versus = c === null ? '' : c === 'unchanged' ? ', unchanged on the year before' : `, ${c} on the year before`;
    monthSentences.push(`${roughly(latestArrivals)} people arrived in the UK on small boats in the ${latestLabel}${versus}.`);
  }
  const grid = months?.arrivals ?? [];
  const monthYears = months?.years ?? [];
  let busiest = null;
  grid.forEach((row, r) =>
    row.forEach((v, m) => {
      if (known(v) && (busiest === null || v > busiest.v)) busiest = { v, r, m };
    }),
  );
  if (busiest && busiest.v > 0) {
    monthSentences.push(`The busiest month since ${monthYears[0]} was ${MONTHS[busiest.m]} ${monthYears[busiest.r]}: ${formatCount(busiest.v)} people.`);
  }
  // Season line: the latest year with all twelve months published and at least 100 arrivals.
  const fullYear = monthYears
    .map((year, r) => ({ year, row: grid[r] ?? [] }))
    .filter(({ row }) => row.length === 12 && row.every(known) && sum(row) >= MIN_BASE)
    .at(-1);
  if (fullYear) {
    const share = sum(fullYear.row.slice(4, 10)) / sum(fullYear.row);
    monthSentences.push(`${formatPercent(share)} of ${fullYear.year}'s arrivals came between May and October.`);
  }
  $('month-summary').textContent = monthSentences.join(' ');

  if (grid.length) {
    const table = $('month-heat');
    heatTable(table, {
      caption: 'Small boat arrivals by year and month, people',
      rowHead: 'Year',
      columns: MONTHS.map((m) => m.slice(0, 3)),
      rows: monthYears.map(String),
      cells: grid,
    });
    // Totals column, unshaded so it doesn't swamp the month shades.
    const totalHead = el('th', 'govuk-table__header', 'Total');
    totalHead.scope = 'col';
    table.querySelector('thead tr').append(totalHead);
    [...table.querySelectorAll('tbody tr')].forEach((tr, r) => {
      const row = grid[r] ?? [];
      tr.append(el('td', 'govuk-table__cell govuk-table__cell--numeric mag-heat__cell', row.some(known) ? formatCount(sum(row)) : '–'));
    });
  } else {
    $('month-heat').closest('.mag-table-scroll').replaceWith(emptyNote());
  }

  // ---------------------------------------------------------------- people per boat
  if (perBoatShown.length) {
    const first = perBoatShown[0];
    const now = perBoatShown.at(-1);
    let sentence = `Boats carried an average of ${formatOneDp(now.perBoat)} people in ${now.label}`;
    if (perBoatShown.length > 1) {
      const a = Math.round(now.perBoat * 10);
      const b = Math.round(first.perBoat * 10);
      sentence += a === b ? `, the same as in ${first.label}` : `, ${a > b ? 'up' : 'down'} from ${formatOneDp(first.perBoat)} in ${first.label}`;
    }
    $('perboat-summary').textContent = `${sentence}.`;
    const partYear = now.label !== String(now.year);
    createChart($('perboat-chart'), { formatValue: formatOneDp, formatX: (v) => String(v) }).update({
      labels: perBoatShown.map((p) => p.label),
      dates: perBoatShown.map((p) => p.year),
      series: [{ id: 'perboat', label: 'People per boat', values: perBoatShown.map((p) => p.perBoat), style: 's6' }],
      summary: `Line chart of the average number of people per small boat each year, ${first.year} to ${now.year}${partYear ? ` (${now.label} for the latest)` : ''}.`,
    });
    $('perboat-table').append(
      alignNumeric(
        renderTable({
          caption: 'Small boat arrivals, boats and people per boat each year',
          head: ['Year', 'People', 'Boats', 'People per boat'],
          rows: perBoatShown.map((p) => [p.label, formatCount(p.people), formatCount(p.boats), formatOneDp(p.perBoat)]),
        }),
      ),
    );
  } else {
    $('perboat-chart').append(emptyNote());
  }

  // ---------------------------------------------------------------- who arrives
  const whoSentences = [];
  const named = nationalities.filter((n) => known(n.arrivals));
  if (latestLabel) $('who-bars-title').textContent = `Small boat arrivals by nationality, ${latestLabel}`;
  if (named.length && known(latestArrivals) && latestArrivals >= MIN_BASE) {
    const top = named.slice(0, 5);
    const share = sum(top.map((n) => n.arrivals)) / latestArrivals;
    const which = top.length === 1 ? `the nationality ${top[0].name}` : `one of ${NUMBER_WORDS[top.length]} nationalities: ${list(top.map((n) => n.name))}`;
    whoSentences.push(
      share > 0.5
        ? `Most small boat arrivals in the ${latestLabel} (${formatPercent(share)}) were recorded with ${which}.`
        : `${formatPercent(share)} of small boat arrivals in the ${latestLabel} were recorded with ${which}.`,
    );
  }
  if (ageSex && known(ageSex.male) && known(ageSex.female)) {
    const when = whoSentences.length ? 'In the same year' : `In the ${latestLabel}`;
    let s = `${when}, ${roughly(ageSex.male)} arrivals were recorded as male and ${roughly(ageSex.female)} as female`;
    if (known(ageSex.under18)) s += `, and ${roughly(ageSex.under18)} as aged 17 or under`;
    whoSentences.push(`${s}.`);
  }
  $('who-summary').textContent = whoSentences.join(' ');
  if (known(notRecorded) && notRecorded > 0) {
    $('who-not-recorded').textContent = `${formatCount(notRecorded)} arrivals whose nationality is not yet recorded count in the total but not in the list.`;
  }

  if (named.length) {
    const scale = Math.max(...named.map((n) => Math.max(n.arrivals, n.previous ?? 0)));
    $('who-chart').append(
      markedBars(
        named.map((n) => ({ label: n.name, value: n.arrivals, text: formatCount(n.arrivals), mark: n.previous, markText: formatCount(n.previous) })),
        scale,
        'the year before',
      ),
    );
    $('who-table').append(
      renderTable({
        caption: `Small boat arrivals by nationality, ${latestLabel} and the year before`,
        head: ['Nationality', latestLabel ?? 'Latest year', years[last - 1]?.label ?? 'The year before'],
        rows: named.map((n) => [n.name, n.arrivals, n.previous ?? null]),
      }),
    );
  } else {
    $('who-chart').append(emptyNote());
  }
  if (ageSex && [ageSex.male, ageSex.female, ageSex.under18].some(known)) {
    const ageTiles = [
      { v: ageSex.male, label: 'recorded as male' },
      { v: ageSex.female, label: 'recorded as female' },
      { v: ageSex.under18, label: 'recorded as aged 17 or under' },
    ].filter((t) => known(t.v));
    $('who-tiles').append(tiles(ageTiles.map((t) => ({ value: roughly(t.v), label: t.label }))));
  } else {
    $('who-tiles').append(emptyNote());
  }

  // ---------------------------------------------------------------- claiming asylum
  const cohort = claimed.filter((c) => known(c.arrivals) && c.arrivals >= MIN_BASE).at(-1);
  if (cohort && known(cohort.asylumOnly)) {
    const both = known(cohort.asylumAndNrm) ? cohort.asylumAndNrm : null;
    const parts = [];
    if (both !== null) {
      parts.push(`${formatPercent(cohort.asylumOnly + both)} claimed asylum, including ${formatPercent(both)} who were also referred as possible victims of modern slavery`);
    } else {
      parts.push(`${formatPercent(cohort.asylumOnly)} claimed asylum without a modern slavery referral`);
    }
    if (known(cohort.neither)) parts.push(`${formatPercent(cohort.neither)} did neither`);
    $('claimed-summary').textContent = `Of people who arrived by small boat in ${cohort.year}, ${parts.join('; ')}.`;
    $('claimed-bars-title').textContent = `What people arriving by small boat in ${cohort.year} did`;
    const rows = [
      { label: 'Asylum claim only', value: cohort.asylumOnly },
      { label: 'Asylum and modern slavery referral', value: cohort.asylumAndNrm },
      { label: 'Neither', value: cohort.neither },
    ].filter((r) => known(r.value));
    $('claimed-chart').append(bars(rows.map((r) => ({ ...r, text: formatPercent(r.value) })), 1));
  } else {
    $('claimed-chart').append(emptyNote());
  }
  const pct = (v) => (known(v) ? formatPercent(v) : 'not published');
  if (claimed.length) {
    $('claimed-table').append(
      alignNumeric(
        renderTable({
          caption: 'What small boat arrivals did, by year of arrival (shares of that year’s arrivals)',
          head: ['Year of arrival', 'Arrivals', 'Claimed asylum only', 'Asylum and modern slavery referral', 'Neither'],
          rows: claimed.map((c) => [String(c.year), formatCount(c.arrivals), pct(c.asylumOnly), pct(c.asylumAndNrm), pct(c.neither)]),
          open: true,
        }),
      ),
    );
  }

  // ---------------------------------------------------------------- returns
  const returnSentences = [];
  const rYears = returns?.years ?? [];
  const rl = rYears.length - 1;
  if (rl >= 0 && known(returns.enforced[rl]) && known(returns.voluntary[rl])) {
    let s = `There were ${roughly(returns.voluntary[rl])} voluntary returns and ${roughly(returns.enforced[rl])} enforced returns from the UK in the ${rYears[rl].label}`;
    const clauses = [];
    const c = rl > 0 ? change(returns.enforced[rl], returns.enforced[rl - 1]) : null;
    if (c) clauses.push(c === 'unchanged' ? 'unchanged on a year earlier' : `${c} on a year earlier`);
    if (rl > 1 && known(returns.enforced[0])) {
      const then = returns.enforced[0];
      const now = returns.enforced[rl];
      const side = now > then ? 'above' : now < then ? 'below' : 'level with';
      clauses.push(`${side} their level in the ${rYears[0].label} (${formatCount(then)})`);
    }
    if (clauses.length) s += `; enforced returns were ${clauses.join(' and ')}`;
    returnSentences.push(`${s}.`);
  }
  const quarters = smallBoatReturns?.quarters ?? [];
  if (quarters.length >= 4 && known(smallBoatReturns.latestYear)) {
    const from = quarters.at(-4);
    const to = quarters.at(-1);
    const span = `${from.label.split(' to ')[0]} ${from.key.slice(0, 4)} to ${to.label.split(' to ').at(-1)}`;
    returnSentences.push(`${formatCount(smallBoatReturns.latestYear)} people who arrived by small boat were returned in the last four quarters (${span}).`);
  }
  $('returns-summary').textContent = returnSentences.join(' ');

  if (rYears.length > 1) {
    createChart($('returns-chart'), { formatX: (v) => String(v) }).update({
      labels: rYears.map(withProvisional),
      dates: rYears.map((y) => y.year),
      series: [
        { id: 'enforced', label: 'Enforced', values: returns.enforced, style: 's6' },
        { id: 'voluntary', label: 'Voluntary', values: returns.voluntary, style: 's1' },
        { id: 'refused', label: 'Refused at port', values: returns.refusedAtPort, style: 's2' },
      ],
      summary: `Line chart of enforced returns, voluntary returns and people refused entry at port who then left, each year ending June from ${rYears[0].year} to ${rYears[rl].year}.`,
    });
    $('returns-table').append(
      renderTable({
        caption: 'Returns from the UK by type, years ending June',
        head: ['Year', 'Enforced returns', 'Voluntary returns', 'Refused entry at port and departed'],
        rows: rYears.map((y, i) => [withProvisional(y), returns.enforced[i] ?? null, returns.voluntary[i] ?? null, returns.refusedAtPort[i] ?? null]),
      }),
    );
  } else {
    $('returns-chart').append(emptyNote());
  }

  if (quarters.length > 1) {
    const qDate = (key) => new Date(Date.UTC(Number(key.slice(0, 4)), (Number(key.slice(-1)) - 1) * 3 + 1, 15));
    createChart($('returns-boat-chart')).update({
      labels: quarters.map(withProvisional),
      dates: quarters.map((q) => qDate(q.key)),
      series: [{ id: 'boat-returns', label: 'Returns', values: smallBoatReturns.returns, style: 's6' }],
      summary: `Line chart of returns of people who arrived by small boat each quarter, ${quarters[0].label} to ${quarters.at(-1).label}.`,
    });
    $('returns-boat-table').append(
      renderTable({
        caption: 'Returns of people who arrived by small boat, by quarter of return',
        head: ['Quarter', 'Returns'],
        rows: quarters.map((q, i) => [withProvisional(q), smallBoatReturns.returns[i] ?? null]),
      }),
    );
  } else {
    $('returns-boat-chart').append(emptyNote());
  }
});
