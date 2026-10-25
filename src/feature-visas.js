// Visas Issued: entry clearance visas by type, the work route's peak and fall, the Health and
// Care Worker route by quarter and by occupation, dependants, and the jobs behind sponsored
// work visas. Two Home Office sources: the visa data (all applicant types) and the occupation
// data (main applicants only, a little below the visa figures). Every sentence names which.

import { $, fill, startFeature } from './feature-page.js';
import { bars, el, emptyNote, formatCount, formatPercent, heatTable, list, lower, renderTable, roughly, tiles } from './charts.js';
import { createChart } from './line-chart.js';
import './styles/visas.scss';

const ok = (v) => v !== null && v !== undefined && Number.isFinite(v);
const cap = (s) => s[0].toUpperCase() + s.slice(1);
/** Index of the last usable value, or -1. */
const lastIndex = (values) => {
  for (let i = values.length - 1; i >= 0; i--) if (ok(values[i])) return i;
  return -1;
};
/** Index of the largest value (the first, on a tie), or -1. */
const peakIndex = (values) => values.reduce((best, v, i) => (ok(v) && (best < 0 || v > values[best]) ? i : best), -1);
/** "up 12%", "down 3%", or "about the same as" when it rounds to 0%. */
const direction = (now, before) => {
  const ch = now / before - 1;
  if (Math.abs(ch) < 0.005) return 'about the same as';
  return `${ch < 0 ? 'down' : 'up'} ${formatPercent(Math.abs(ch))} on`;
};
const yearLabel = (y) => `${y.year}${y.provisional ? ' (provisional)' : ''}`;
const juneDate = (y) => new Date(Date.UTC(y.year, 5, 30));
const quarterDate = (q) => {
  const [y, n] = q.key.split(' Q').map(Number);
  return new Date(Date.UTC(y, (n - 1) * 3 + 1, 15));
};

startFeature('visas', (data) => {
  const { years = [], grants = {}, work = {}, grantRate = {}, quarters = [], routes = {}, routeShares = {}, occupation = {} } = data;

  // Provisional figures, said in every method note from the data.
  const firstProv = quarters.find((q) => q.provisional);
  fill('provisional', firstProv ? `Figures from ${firstProv.label} on are provisional.` : '');
  if (quarters.length) fill('first-quarter', quarters[0].label);

  // ------------------------------------------------------------ What visas are for
  const total = grants.total ?? [];
  const li = lastIndex(total);
  const GROUPS = [
    { id: 'work', label: 'Work', style: 's6' },
    { id: 'study', label: 'Study', style: 's1' },
    { id: 'family', label: 'Family', style: 's2' },
    { id: 'visitor', label: 'Visitor', style: 's3' },
    { id: 'other', label: 'Other', style: 's4' },
  ];
  if (li < 0) {
    $('groups-summary').textContent = 'No visa figures are available in this data.';
    $('groups-chart').append(emptyNote());
  } else {
    const label = years[li].label;
    const at = (id) => grants[id]?.[li];
    const visitorShare = at('visitor') / total[li];
    const heroTiles = [{ value: roughly(total[li]), label: `entry clearance visas issued, ${label}` }];
    if (total[li] > 0 && ok(at('visitor'))) heroTiles.push({ value: formatPercent(visitorShare), label: 'of them visitor visas' });
    if (ok(at('work'))) heroTiles.push({ value: roughly(at('work')), label: 'work visas, including dependants' });
    $('hero-graphic').append(tiles(heroTiles));

    let text = `The UK issued ${roughly(total[li])} entry clearance visas in the ${label}.`;
    if (total[li] > 0 && ok(at('visitor')) && ok(at('study')) && ok(at('work'))) {
      const pair = [
        { n: at('study'), what: 'for study' },
        { n: at('work'), what: 'for work' },
      ].sort((a, b) => b.n - a.n);
      text += ` Visitor visas made up ${formatPercent(visitorShare)} of them; ${roughly(pair[0].n)} were ${pair[0].what} and ${roughly(pair[1].n)} ${pair[1].what}.`;
    }
    const rated = GROUPS.filter((g) => g.id !== 'other' && ok(grantRate[g.id]));
    if (ok(grantRate.all) && rated.length >= 2) {
      const sorted = [...rated].sort((a, b) => grantRate[b.id] - grantRate[a.id]);
      const hi = sorted[0];
      const lo = sorted.at(-1);
      text += ` Of applications issued or refused, ${formatPercent(grantRate.all)} were issued: from ${formatPercent(grantRate[hi.id])} for ${lower(hi.label)} visas to ${formatPercent(grantRate[lo.id])} for ${lower(lo.label)} visas.`;
    }
    $('groups-summary').textContent = text;

    createChart($('groups-chart')).update({
      labels: years.map((y) => `${cap(y.label)}${y.provisional ? ' (provisional)' : ''}`),
      dates: years.map(juneDate),
      series: GROUPS.map((g) => ({ id: g.id, label: g.label, values: grants[g.id] ?? years.map(() => null), style: g.style })),
      summary: `Line chart of entry clearance visas issued by visa type, ${years[0].label} to the ${years.at(-1).label}.`,
    });
  }
  $('groups-table').append(
    renderTable({
      caption: 'Entry clearance visas issued, by visa type, years ending June',
      head: ['Year ending June', 'Total', ...GROUPS.map((g) => g.label)],
      rows: years.map((y, i) => [yearLabel(y), total[i] ?? null, ...GROUPS.map((g) => grants[g.id]?.[i] ?? null)]),
    }),
  );

  // ------------------------------------------------------------ Work visas: peak and fall
  const wv = grants.work ?? [];
  const wi = lastIndex(wv);
  if (wi < 0) {
    $('work-summary').textContent = 'No work visa figures are available in this data.';
    $('work-chart').append(emptyNote());
  } else {
    const now = wv[wi];
    let text = `${cap(roughly(now))} work visas were issued in the ${years[wi].label}, including dependants`;
    const before = wv[wi - 1];
    const parts = [];
    if (wi > 0 && ok(before) && before > 0) parts.push(`${direction(now, before)} a year earlier`);
    if (wi > 0) {
      const fell = !ok(before) || now <= before;
      // The last earlier year beyond today's figure (lower for "fewest", higher for "most").
      let since = -1;
      for (let i = wi - 1; i >= 0; i--) {
        if (ok(wv[i]) && (fell ? wv[i] <= now : wv[i] >= now)) {
          since = i;
          break;
        }
      }
      if (since === wi - 1) {
        // Not a record of any kind: say nothing more.
      } else if (since >= 0) parts.push(`the ${fell ? 'fewest' : 'most'} since the ${years[since].label}`);
      else parts.push(`the ${fell ? 'fewest' : 'most'} in the series, which starts in the ${years[0].label}`);
    }
    text += parts.length ? `: ${list(parts)}.` : '.';
    const pk = peakIndex(wv);
    if (pk >= 0 && pk !== wi) text += ` The peak was ${roughly(wv[pk])} in the ${years[pk].label}.`;
    if (ok(work.main?.[wi]) && ok(work.dependant?.[wi])) {
      text += ` Of the ${years[wi].label} total, ${formatCount(work.main[wi])} went to main applicants and ${formatCount(work.dependant[wi])} to dependants.`;
    }
    $('work-summary').textContent = text;

    createChart($('work-chart')).update({
      labels: years.map((y) => `${cap(y.label)}${y.provisional ? ' (provisional)' : ''}`),
      dates: years.map(juneDate),
      series: [
        { id: 'main', label: 'Main applicants', values: work.main ?? years.map(() => null), style: 's6' },
        { id: 'dependant', label: 'Dependants', values: work.dependant ?? years.map(() => null), style: 's1' },
      ],
      summary: `Line chart of work visas issued to main applicants and to dependants, ${years[0].label} to the ${years.at(-1).label}.`,
    });
  }
  $('work-table').append(
    renderTable({
      caption: 'Work visas issued, years ending June',
      head: ['Year ending June', 'Main applicants', 'Dependants', 'Total'],
      rows: years.map((y, i) => [yearLabel(y), work.main?.[i] ?? null, work.dependant?.[i] ?? null, wv[i] ?? null]),
    }),
  );

  // ------------------------------------------------------------ The care worker years
  const hc = routes.healthCareMain ?? [];
  const sk = routes.skilledMain ?? [];
  const qi = lastIndex(hc);
  const careText = [];
  const qLabel = (q) => `${q.label}${q.provisional ? ' (provisional)' : ''}`;
  if (qi >= 0) {
    const counted = hc.filter(ok).length;
    const pk = peakIndex(hc);
    if (counted >= 4 && pk !== qi) {
      careText.push(`Health and Care Worker visas for main applicants peaked at ${formatCount(hc[pk])} in ${quarters[pk].label}; in ${qLabel(quarters[qi])}, ${formatCount(hc[qi])} were issued.`);
    } else if (counted >= 4) {
      careText.push(`${formatCount(hc[qi])} Health and Care Worker visas were issued to main applicants in ${qLabel(quarters[qi])}, the most in any quarter shown.`);
    } else {
      careText.push(`${formatCount(hc[qi])} Health and Care Worker visas were issued to main applicants in ${qLabel(quarters[qi])}.`);
    }
    createChart($('care-chart')).update({
      labels: quarters.map(qLabel),
      dates: quarters.map(quarterDate),
      series: [
        { id: 'health-care', label: 'Health and Care Worker', values: hc, style: 's6' },
        { id: 'skilled', label: 'Skilled Worker', values: sk.length ? sk : quarters.map(() => null), style: 's1' },
      ],
      summary: `Line chart of visas issued to main applicants each quarter on the Health and Care Worker and Skilled Worker routes, ${quarters[0].label} to ${quarters.at(-1).label}.`,
    });
  } else {
    $('care-chart').append(emptyNote());
  }
  $('care-quarters').append(
    renderTable({
      caption: 'Visas issued to main applicants, by quarter',
      head: ['Quarter', 'Health and Care Worker', 'Skilled Worker'],
      rows: quarters.map((q, i) => [`${q.key}${q.provisional ? ' (provisional)' : ''}`, hc[i] ?? null, sk[i] ?? null]),
    }),
  );

  const oy = occupation.years ?? [];
  const byGroup = occupation.healthCareByGroup ?? {};
  const OCC = [
    { id: 'care', name: 'Caring personal services', subject: 'Care workers (caring personal services)' },
    { id: 'nurses', name: 'Nursing professionals', subject: 'Nurses' },
    { id: 'doctors', name: 'Medical practitioners', subject: 'Doctors' },
    { id: 'other', name: 'Other occupations', subject: 'Other occupations, together,' },
  ];
  const care = byGroup.care ?? [];
  const ci = lastIndex(care);
  if (ci >= 0) {
    const cp = peakIndex(care);
    const occ = 'In the occupation data (main applicants only)';
    if (cp !== ci) {
      careText.push(`${occ}, visas for caring personal services went from ${formatCount(care[cp])} in the ${oy[cp].label} to ${formatCount(care[ci])} in the ${oy[ci].label}.`);
    } else {
      careText.push(`${occ}, ${formatCount(care[ci])} visas were for caring personal services in the ${oy[ci].label}, the most in any year shown.`);
    }
    const largestAt = (i) => OCC.filter((g) => ok(byGroup[g.id]?.[i])).sort((a, b) => byGroup[b.id][i] - byGroup[a.id][i])[0];
    const nowTop = largestAt(ci);
    const firstTop = largestAt(0);
    if (nowTop && byGroup[nowTop.id][ci] > 0 && oy.length > 1) {
      const verb = firstTop && firstTop.id === nowTop.id ? 'are still' : 'are now';
      careText.push(`${nowTop.subject} ${verb} the largest group on the route: ${formatCount(byGroup[nowTop.id][ci])} visas.`);
    }
  }
  $('care-summary').textContent = careText.length ? careText.join(' ') : 'No Health and Care Worker figures are available in this data.';
  heatTable($('care-heat'), {
    caption: 'Health and Care Worker visas for main applicants, by occupation group, years ending June (occupation data)',
    rowHead: 'Occupation group',
    columns: oy.map(yearLabel),
    rows: OCC.map((g) => g.name),
    cells: OCC.map((g) => oy.map((_, i) => byGroup[g.id]?.[i] ?? null)),
  });

  // ------------------------------------------------------------ Family members
  const ROUTES = [
    { id: 'healthCare', name: 'Health and Care Worker' },
    { id: 'skilled', name: 'Skilled Worker' },
  ];
  const latest = years.at(-1)?.label ?? 'latest year';
  const shown = ROUTES.filter((r) => ok(routeShares[r.id]?.main) && ok(routeShares[r.id]?.dependant));
  if (shown.length) {
    const big = (r) => routeShares[r.id].main + routeShares[r.id].dependant >= 100;
    const full = (r) => {
      const { main, dependant } = routeShares[r.id];
      return big(r)
        ? `${formatPercent(dependant / (main + dependant))} of ${r.name} visas went to dependants (${formatCount(dependant)}, against ${formatCount(main)} to main applicants)`
        : `${r.name} visas went to ${formatCount(dependant)} dependants and ${formatCount(main)} main applicants`;
    };
    let text = `In the ${latest}, ${full(shown[0])}`;
    if (shown[1] && big(shown[0]) && big(shown[1])) {
      const { main, dependant } = routeShares[shown[1].id];
      text += `, as did ${formatPercent(dependant / (main + dependant))} of ${shown[1].name} visas (${formatCount(dependant)} against ${formatCount(main)})`;
    } else if (shown[1]) text += `; ${full(shown[1])}`;
    $('dependants-summary').textContent = `${text}.`;

    const scale = Math.max(...shown.flatMap((r) => [routeShares[r.id].main, routeShares[r.id].dependant]));
    const cols = el('div');
    for (const r of shown) {
      const col = el('div');
      col.append(
        el('h4', 'govuk-heading-s mag-visas-route', r.name),
        bars(
          [
            { label: 'Main applicants', value: routeShares[r.id].main },
            { label: 'Dependants', value: routeShares[r.id].dependant },
          ],
          scale,
          'mag-bars mag-visas-bars',
        ),
      );
      cols.append(col);
    }
    $('dependants-chart').append(cols);
    $('dependants-table').append(
      renderTable({
        caption: `Visas issued by route and applicant type, ${latest}`,
        head: ['Route', 'Main applicants', 'Dependants', 'Total'],
        rows: shown.map((r) => [r.name, routeShares[r.id].main, routeShares[r.id].dependant, routeShares[r.id].main + routeShares[r.id].dependant]),
      }),
    );
  } else {
    $('dependants-summary').textContent = 'No route figures are available in this data.';
    $('dependants-chart').append(emptyNote());
  }

  // ------------------------------------------------------------ The jobs behind the visas
  const occLatest = oy.at(-1)?.label ?? 'latest year';
  const top = (occupation.topJobs ?? []).filter((j) => ok(j.grants));
  const jobsText = [];
  if (top.length) {
    let s = `In the occupation data, ${lower(top[0].name)} had the most Skilled Worker and Health and Care Worker visas for main applicants in the ${occLatest} (${formatCount(top[0].grants)})`;
    const next = top.slice(1, 3).map((j) => lower(j.name));
    s += next.length ? `, followed by ${list(next)}.` : '.';
    jobsText.push(s);
    $('jobs-chart').append(bars(top.map((j) => ({ label: j.name, value: j.grants })), top[0].grants, 'mag-bars mag-visas-bars'));
    $('jobs-table').append(
      renderTable({
        caption: `Most common jobs, Skilled Worker and Health and Care Worker visas for main applicants, ${occLatest}`,
        head: ['Occupation (SOC 2020 code)', 'Visas'],
        rows: top.map((j) => [`${j.name} (${j.code})`, j.grants]),
      }),
    );
  } else {
    $('jobs-chart').append(emptyNote());
  }

  const routesList = (occupation.sponsoredRoutes ?? []).filter((r) => ok(r.grants));
  const sTotal = occupation.sponsoredTotal;
  if (routesList.length && ok(sTotal) && sTotal > 0) {
    const biggest = [...routesList].sort((a, b) => b.grants - a.grants)[0];
    const name = biggest.route === 'Other sponsored routes' ? 'Other sponsored routes together' : `The ${biggest.route} route`;
    let s = `${name} accounted for ${formatCount(biggest.grants)} of ${formatCount(sTotal)} sponsored work visas for main applicants (${formatPercent(biggest.grants / sTotal)})`;
    if (biggest.route === 'Seasonal Worker') {
      const g = (n) => routesList.find((r) => r.route === n)?.grants;
      const both = g('Skilled Worker') + g('Health and Care Worker');
      if (ok(both) && biggest.grants > both) s += ', more than Skilled Worker and Health and Care Worker together';
    }
    jobsText.push(`${s}.`);
    const sorted = [...routesList.filter((r) => r.route !== 'Other sponsored routes'), ...routesList.filter((r) => r.route === 'Other sponsored routes')];
    $('routes-chart').append(bars(sorted.map((r) => ({ label: r.route, value: r.grants })), Math.max(...sorted.map((r) => r.grants)), 'mag-bars mag-visas-bars'));
    $('routes-table').append(
      renderTable({
        caption: `Sponsored work visas for main applicants, by route, ${occLatest}`,
        head: ['Route', 'Visas', 'Share'],
        rows: [...sorted.map((r) => [r.route, r.grants, formatPercent(r.grants / sTotal)]), ['All sponsored routes', sTotal, formatPercent(1)]],
      }),
    );
  } else {
    $('routes-chart').append(emptyNote());
  }
  $('jobs-summary').textContent = jobsText.length ? jobsText.join(' ') : 'No occupation figures are available in this data.';
});
