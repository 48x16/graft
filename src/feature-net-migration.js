// In and Out: ONS long-term international migration. Net migration over time, by nationality,
// reasons for arriving (non-EU+), dependants, and how the first estimate for a year moved.
// "Highest" and "peak" claims only look at periods on current methods (newMethod, from the
// year ending June 2021).

import { $, startFeature } from './feature-page.js';
import { bars, emptyNote, formatCount, renderTable, roughly, tiles } from './charts.js';
import { createChart } from './line-chart.js';

const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const dateOf = (key) => {
  const [y, m] = key.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, 1));
};
/** −136,000 / +350,000 for tables and bar values. */
const signedCount = (v) => (v === null || v === undefined ? 'not published' : `${v > 0 ? '+' : v < 0 ? '−' : ''}${formatCount(Math.abs(v))}`);
/** Index of the largest value among `indices` (first at its maximum), or -1. */
function peakOf(values, indices) {
  let best = -1;
  for (const i of indices) if (isNum(values[i]) && (best < 0 || values[i] > values[best])) best = i;
  return best;
}
/** "350,000 more arrived than left" / "42,000 more left than arrived" / "about as many arrived as left". */
function balance(n) {
  if (n > 0) return `${roughly(n)} more arrived than left`;
  if (n < 0) return `${roughly(-n)} more left than arrived`;
  return 'about as many arrived as left';
}
/** A vertical rule at the June 2021 method break, if the chart starts before it. */
function breakMarker(list) {
  const i = list.findIndex((q) => q.newMethod ?? q.key >= '2021-06');
  return i > 0 ? [{ date: dateOf(list[i].key), label: 'New method' }] : [];
}
/** Small counts: ONS shows under 500 as 0. */
const deps = (v) => (v === 0 ? 'fewer than 500' : roughly(v));

startFeature('net-migration', (data) => {
  const periods = data.periods ?? [];
  const flows = data.flows ?? {};
  const imm = flows.immigration ?? {};
  const emi = flows.emigration ?? {};
  const net = flows.net ?? {};
  const last = periods.length - 1;
  const current = periods.map((p, i) => (p.newMethod ? i : -1)).filter((i) => i >= 0);

  // Hero: the latest year's three headline figures.
  if (last >= 0 && isNum(net.all?.[last])) {
    const label = periods[last].label;
    $('hero-graphic').append(
      tiles([
        { value: roughly(net.all[last]), label: `net migration to the UK, ${label}` },
        { value: roughly(imm.all[last]), label: 'people arrived to live in the UK' },
        { value: roughly(emi.all[last]), label: 'people left the UK to live abroad' },
      ]),
    );
  }

  drawNet();
  drawGroups();
  drawReasons();
  drawDependants();
  drawRevisions();

  // 1. Net migration over time.
  function drawNet() {
    if (last < 0 || !isNum(net.all?.[last])) {
      $('net-summary').textContent = 'No net migration figures are available in this data.';
      $('net-chart').append(emptyNote());
      return;
    }
    const p = periods[last];
    const n = net.all[last];
    const opening = n >= 0
      ? `Net migration to the UK was ${roughly(n)} in the ${p.label}${p.provisional ? ' (provisional)' : ''}`
      : `More people left the UK than arrived in the ${p.label}${p.provisional ? ' (provisional)' : ''}, a net outflow of ${roughly(-n)}`;
    const parts = [`${opening}: ${roughly(imm.all[last])} people arrived to live here for a year or more and ${roughly(emi.all[last])} left.`];
    const prev = last - 4;
    if (prev >= 0 && isNum(net.all[prev])) {
      const before = net.all[prev];
      parts.push(`A year earlier it was ${roughly(before)}.`);
    }
    if (p.newMethod && current.length > 1) {
      const peak = peakOf(net.all, current);
      parts.push(
        peak === last
          ? 'The highest on current methods (since the year ending June 2021).'
          : `On current methods (since the year ending June 2021) the peak was ${roughly(net.all[peak])}, in the ${periods[peak].label}.`,
      );
    }
    $('net-summary').textContent = parts.join(' ');

    const provisional = periods.filter((q) => q.provisional).length;
    const revised = periods.filter((q) => q.revised).length;
    const flagParts = [];
    if (provisional) flagParts.push(`the latest ${provisional === 1 ? 'year is' : `${provisional} rolling years are`} provisional`);
    if (revised) flagParts.push(`${revised === 1 ? 'one earlier year was' : `${revised} were`} revised in this release`);
    if (flagParts.length) $('net-flags').textContent = flagParts.join(' and ');

    const iv = data.interval;
    if (iv && isNum(iv.lower) && isNum(iv.upper)) {
      $('net-range').textContent = `ONS puts the ${iv.label} net figure somewhere between ${formatCount(iv.lower)} and ${formatCount(iv.upper)} (95% confidence).`;
    }

    const breakAt = periods.findIndex((q) => q.newMethod);
    if (breakAt > 0) $('net-break').textContent = `Methods changed from the ${periods[breakAt].label}: figures before it are not directly comparable.`;

    createChart($('net-chart')).update({
      labels: periods.map((q) => q.label),
      dates: periods.map((q) => dateOf(q.key)),
      series: [
        { id: 'immigration', label: 'Arrived', values: imm.all, style: 's1' },
        { id: 'emigration', label: 'Left', values: emi.all, style: 's2' },
        { id: 'net', label: 'Net migration', values: net.all, style: 's6' },
      ],
      summary: `Line chart of people arriving in and leaving the UK for a year or more, and net migration, ${periods[0].label} to ${p.label}. A rule marks the change of method in the year ending June 2021.`,
      markers: breakMarker(periods),
    });
    $('net-table').append(
      renderTable({
        caption: 'Arrivals, departures and net migration, UK, rolling years',
        head: ['Year ending', 'Arrived', 'Left', 'Net'],
        rows: periods.map((q, i) => [`${q.label}${q.provisional ? ' (provisional)' : ''}`, imm.all[i], emi.all[i], signedCount(net.all[i])]),
      }),
    );
  }

  // 2. By nationality, current methods only.
  function drawGroups() {
    const idx = current.filter((i) => isNum(net.british?.[i]));
    if (!idx.length) {
      $('groups-summary').textContent = 'No figures by nationality on current methods are available in this data.';
      $('groups-chart').append(emptyNote());
      return;
    }
    const at = idx.at(-1);
    const p = periods[at];
    const b = net.british[at];
    const parts = [];
    const flows = isNum(emi.british?.[at]) && isNum(imm.british?.[at]) ? `: ${deps(emi.british[at])} left to live abroad and ${deps(imm.british[at])} arrived` : '';
    if (b < 0) {
      const leaving = idx.map((i) => -net.british[i]);
      const most = leaving.indexOf(Math.max(...leaving));
      const isMost = idx.length > 1 && most === leaving.length - 1;
      const later = idx.length > 1 && !isMost ? ` The most on current methods was ${roughly(leaving[most])}, in the ${periods[idx[most]].label}.` : '';
      parts.push(`In the ${p.label}, ${roughly(-b)} more British nationals left the UK than arrived${isMost ? ', the most on current methods' : ''}${flows}.${later}`);
    } else if (b > 0) {
      parts.push(`In the ${p.label}, ${roughly(b)} more British nationals arrived in the UK than left${flows}.`);
    } else {
      parts.push(`In the ${p.label}, about as many British nationals arrived in the UK as left${flows}.`);
    }
    if (isNum(net.euPlus?.[at])) parts.push(`EU+ nationals: ${balance(net.euPlus[at])}.`);
    if (isNum(net.nonEuPlus?.[at])) parts.push(`Non-EU+ nationals: ${balance(net.nonEuPlus[at])}.`);
    $('groups-summary').textContent = parts.join(' ');

    if (idx.length > 1) {
      createChart($('groups-chart')).update({
        labels: idx.map((i) => periods[i].label),
        dates: idx.map((i) => dateOf(periods[i].key)),
        series: [
          { id: 'british', label: 'British', values: idx.map((i) => net.british[i]), style: 's6' },
          { id: 'euPlus', label: 'EU+', values: idx.map((i) => net.euPlus?.[i] ?? null), style: 's2' },
          { id: 'nonEuPlus', label: 'Non-EU+', values: idx.map((i) => net.nonEuPlus?.[i] ?? null), style: 's1' },
        ],
        summary: `Line chart of net migration to the UK by nationality (British, EU+, non-EU+), ${periods[idx[0]].label} to ${p.label}. Below zero, more left than arrived.`,
      });
    } else {
      $('groups-chart').append(emptyNote('p', 'Only one year on current methods: no trend to show.'));
    }

    // Bars can't run below zero: length shows size, the printed sign shows direction.
    $('groups-bars-title').textContent = `Net migration by nationality, ${p.label}`;
    const rows = [
      ['British', net.british[at]],
      ['EU+', net.euPlus?.[at]],
      ['Non-EU+', net.nonEuPlus?.[at]],
    ].filter(([, v]) => isNum(v));
    const scale = Math.max(...rows.map(([, v]) => Math.abs(v)));
    $('groups-bars').append(
      bars(rows.map(([label, v]) => ({ label: `${label}: ${v < 0 ? 'more left' : v > 0 ? 'more arrived' : 'balanced'}`, value: Math.abs(v), text: signedCount(v) })), scale),
    );
    $('groups-table').append(
      renderTable({
        caption: 'Net migration by nationality, UK, rolling years on current methods',
        head: ['Year ending', 'British', 'EU+', 'Non-EU+', 'British left'],
        rows: idx.map((i) => [periods[i].label, signedCount(net.british[i]), signedCount(net.euPlus?.[i]), signedCount(net.nonEuPlus?.[i]), emi.british?.[i] ?? null]),
      }),
    );
  }

  // 3. Reasons on arrival, non-EU+ nationals.
  function drawReasons() {
    const r = data.reasons ?? {};
    const rp = r.periods ?? [];
    const ri = r.immigration ?? {};
    const lastR = rp.length - 1;
    const NAMES = { work: 'work', study: 'study', family: 'family', humanitarian: 'humanitarian schemes', asylum: 'asylum', other: 'other reasons' };
    const keys = Object.keys(NAMES).filter((k) => Array.isArray(ri[k]));
    if (lastR < 0 || !keys.length) {
      $('reasons-summary').textContent = 'No figures by reason are available in this data.';
      $('reasons-chart').append(emptyNote());
      return;
    }
    const p = rp[lastR];
    const fi = periods.findIndex((q) => q.key === p.key);
    const all = fi >= 0 ? imm.nonEuPlus?.[fi] : null;
    const MIN = 5000; // reasons under 5,000 stay out of the prose
    const parts = [];
    const clauses = ['study', 'work']
      .filter((k) => isNum(ri[k]?.[lastR]) && ri[k][lastR] >= MIN)
      .sort((a, b) => ri[b][lastR] - ri[a][lastR])
      .map((k, i) => `${roughly(ri[k][lastR])} ${i === 0 ? 'came ' : ''}to ${k}`);
    if (isNum(all) && clauses.length) parts.push(`Of the ${roughly(all)} non-EU+ nationals who arrived in the ${p.label}, ${clauses.join(' and ')}.`);
    else if (clauses.length) parts.push(`In the ${p.label}, ${clauses.join(' and ')} (non-EU+ nationals).`);
    const currentR = rp.map((q, i) => (q.key >= '2021-06' ? i : -1)).filter((i) => i >= 0);
    if (Array.isArray(ri.work) && currentR.length > 1 && currentR.includes(lastR)) {
      const peak = peakOf(ri.work, currentR);
      if (peak >= 0 && ri.work[peak] >= MIN) {
        parts.push(
          peak === lastR
            ? 'Work-related arrivals are at their highest on current methods.'
            : `Work-related arrivals peaked at ${roughly(ri.work[peak])}, in the ${rp[peak].label}.`,
        );
      }
    }
    $('reasons-summary').textContent = parts.join(' ') || `No reason reached ${formatCount(MIN)} arrivals in the ${p.label}.`;

    const STYLE = { work: 's6', study: 's1', family: 's2', humanitarian: 's3', asylum: 's4', other: 's5' };
    const LABEL = { work: 'Work', study: 'Study', family: 'Family', humanitarian: 'Humanitarian', asylum: 'Asylum', other: 'Other' };
    if (rp.length > 1) {
      createChart($('reasons-chart')).update({
        labels: rp.map((q) => q.label),
        dates: rp.map((q) => dateOf(q.key)),
        series: keys.map((k) => ({ id: k, label: LABEL[k], values: ri[k], style: STYLE[k] })),
        summary: `Line chart of non-EU+ nationals arriving in the UK by reason (work, study, family, humanitarian, asylum, other), ${rp[0].label} to ${p.label}. A rule marks the change of method in the year ending June 2021.`,
        markers: breakMarker(rp),
      });
    } else {
      $('reasons-chart').append(emptyNote('p', 'Only one year in this data: no trend to show.'));
    }
    $('reasons-table').append(
      renderTable({
        caption: 'Non-EU+ nationals arriving in the UK by reason, rolling years',
        head: ['Year ending', ...keys.map((k) => LABEL[k])],
        rows: rp.map((q, i) => [`${q.label}${q.provisional ? ' (provisional)' : ''}`, ...keys.map((k) => ri[k][i] ?? null)]),
      }),
    );
  }

  // 4. Dependants of work and study visa holders.
  function drawDependants() {
    const r = data.reasons ?? {};
    const rp = r.periods ?? [];
    const ri = r.immigration ?? {};
    const rn = r.net ?? {};
    const lastR = rp.length - 1;
    const KEYS = [
      ['workDependant', 'Work dependants', 's6'],
      ['studyDependant', 'Study dependants', 's1'],
      ['workMain', 'Work, main applicants', 's2'],
      ['studyMain', 'Study, main applicants', 's3'],
    ].filter(([k]) => Array.isArray(ri[k]));
    if (lastR < 0 || !isNum(ri.workDependant?.[lastR])) {
      $('dependants-summary').textContent = 'No figures for dependants are available in this data.';
      $('dependants-chart').append(emptyNote());
      return;
    }
    const p = rp[lastR];
    const wd = ri.workDependant[lastR];
    const currentR = rp.map((q, i) => (q.key >= '2021-06' ? i : -1)).filter((i) => i >= 0);
    let first = `In the ${p.label}, ${deps(wd)} people arrived as dependants of work visa holders`;
    if (currentR.length > 1 && currentR.includes(lastR)) {
      const peak = peakOf(ri.workDependant, currentR);
      first +=
        peak === lastR
          ? ', the most on current methods.'
          : ri.workDependant[peak] === wd
            ? `, level with the peak in the ${rp[peak].label}.`
            : `, down from ${roughly(ri.workDependant[peak])} at the peak in the ${rp[peak].label}.`;
    } else first += '.';
    const parts = [first];
    if (isNum(ri.studyDependant?.[lastR])) {
      const sd = ri.studyDependant[lastR];
      const sn = rn.studyDependant?.[lastR];
      const netClause = !isNum(sn)
        ? ''
        : sn < 0
          ? `, and ${roughly(-sn)} more study dependants left than arrived`
          : sn > 0
            ? `, and ${roughly(sn)} more arrived than left`
            : ', and about as many left as arrived';
      parts.push(`${sd === 0 ? 'Fewer than 500' : roughly(sd)} arrived as dependants of students${netClause}.`);
    }
    $('dependants-summary').textContent = parts.join(' ');

    if (rp.length > 1) {
      createChart($('dependants-chart')).update({
        labels: rp.map((q) => q.label),
        dates: rp.map((q) => dateOf(q.key)),
        series: KEYS.map(([k, label, style]) => ({ id: k, label, values: ri[k], style })),
        summary: `Line chart of non-EU+ main applicants and dependants arriving in the UK for work and study, ${rp[0].label} to ${p.label}. A rule marks the change of method in the year ending June 2021.`,
        markers: breakMarker(rp),
      });
    } else {
      $('dependants-chart').append(emptyNote('p', 'Only one year in this data: no trend to show.'));
    }
    $('dependants-table').append(
      renderTable({
        caption: 'Non-EU+ main applicants and dependants arriving in the UK, rolling years',
        head: ['Year ending', ...KEYS.map(([, label]) => label)],
        rows: rp.map((q, i) => [q.label, ...KEYS.map(([k]) => ri[k][i] ?? null)]),
      }),
    );
  }

  // 5. How one year's estimate moved between releases.
  function drawRevisions() {
    const rev = data.revision;
    const stages = (rev?.stages ?? []).filter((s) => isNum(s.net));
    if (stages.length < 2) {
      $('revisions-summary').textContent = 'Only one estimate has been published for this year so far: nothing has been revised yet.';
      $('revisions-chart').append(emptyNote());
      return;
    }
    const first = stages[0];
    const latest = stages.at(-1);
    const diff = latest.net - first.net;
    const parts = [];
    if (diff === 0) {
      parts.push(`Net migration for the ${rev.label} was first published as ${roughly(first.net)} and still stands there.`);
    } else {
      parts.push(`Net migration for the ${rev.label} was first published as ${roughly(first.net)} and now stands at ${roughly(latest.net)}: revised ${diff < 0 ? 'down' : 'up'} by ${roughly(Math.abs(diff))}.`);
      const britishChange = isNum(first.british) && isNum(latest.british) ? latest.british - first.british : null;
      // How much of the net revision the British net revision accounts for.
      const share = britishChange === null ? 0 : britishChange / diff;
      if (share > 0.5) {
        const lead = share >= 0.9 ? 'Almost all of it' : 'Most of it';
        const outflow = first.british <= 0 && latest.british <= 0;
        const moved = outflow
          ? `their net outflow was revised from ${roughly(-first.british)} to ${roughly(-latest.british)}`
          : `their net migration was revised from ${signedCount(first.british)} to ${signedCount(latest.british)}`;
        // "Mainly because" only when the emigration revision pushes the same way and covers over half of it.
        const emiChange = isNum(first.britishEmigration) && isNum(latest.britishEmigration) ? latest.britishEmigration - first.britishEmigration : null;
        const because =
          emiChange !== null && -emiChange / britishChange > 0.5
            ? `, mainly because British emigration was ${emiChange > 0 ? 'raised' : 'lowered'} from ${roughly(first.britishEmigration)} to ${roughly(latest.britishEmigration)}`
            : '';
        parts.push(`${lead} came from British nationals: ${moved}${because}.`);
      }
    }
    $('revisions-summary').textContent = parts.join(' ');

    $('revisions-bars-title').textContent = `Net migration for the ${rev.label}, release by release`;
    const scale = Math.max(...stages.map((s) => Math.abs(s.net)));
    $('revisions-chart').append(bars(stages.map((s) => ({ label: s.stage, value: Math.abs(s.net), text: signedCount(s.net) })), scale));
    $('revisions-table').append(
      renderTable({
        caption: `Estimates for the ${rev.label}, UK`,
        head: ['Release', 'Net migration', 'British net', 'British left'],
        rows: stages.map((s) => [s.stage, signedCount(s.net), signedCount(s.british), s.britishEmigration ?? null]),
      }),
    );
  }
});

