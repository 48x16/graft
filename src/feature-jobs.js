// Who Works: fifty years of the Labour Force Survey (employment, inactivity, men and women,
// reasons for inactivity, youth unemployment) and the ONS Vacancy Survey. Every sentence is
// built from public/data/features/jobs.json.

import { $, startFeature } from './feature-page.js';
import { emptyNote, formatCount, formatPercent, list, lower, markedBars, oneIn, renderTable, roughly, tiles } from './charts.js';
import { format as d3format } from 'd3';
import { createChart } from './line-chart.js';

// LFS rates are published to one decimal place, and their changes are often a few tenths of
// a point, so prose and tables keep the decimal (formatPercent rounds above 10%).
const rate = (v) => (v === null || v === undefined ? 'not published' : `${(v * 100).toFixed(1)}%`);
const tickCount = d3format('.3~s');
const tickRate = (v) => `${Math.round(v * 100)}%`;
/** Difference between two fractions in tenths of a point (integer), so ties are exact. */
const tenths = (a, b) => Math.round((a - b) * 1000);
const points = (t) => {
  const n = (Math.abs(t) / 10).toFixed(1);
  return `${n} percentage point${n === '1.0' ? '' : 's'}`;
};
// A count that opens a sentence is spelled out.
const NUMBER_WORDS = [null, 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen', 'Twenty'];
const ok = (v) => v !== null && v !== undefined && Number.isFinite(v);

/** Index of the largest (or smallest) non-null value; ties go to the earliest. -1 if none. */
function extreme(values, sign = 1) {
  let best = -1;
  values.forEach((v, i) => {
    if (ok(v) && (best < 0 || sign * (v - values[best]) > 0)) best = i;
  });
  return best;
}

/**
 * A decimal year for a period key "YYYY-MM" (the middle of the middle month). The x axis is
 * numeric (`formatX`) so d3 spaces the year ticks to the width: the time axis puts one every
 * four years on a phone, which runs together over fifty years.
 */
const dateOf = (key) => {
  const [y, m] = key.split('-').map(Number);
  return y + (m - 0.5) / 12;
};
const formatYear = (v) => String(Math.floor(v));

/** Indexes from `from` to the last, every `step`th counting back from the last (oldest first). */
function everyNth(length, step, from = 0) {
  const out = [];
  for (let i = length - 1; i >= from; i -= step) out.push(i);
  return out.reverse();
}

const firstWith = (...arrays) => {
  const n = arrays[0]?.length ?? 0;
  for (let i = 0; i < n; i++) if (arrays.every((a) => ok(a[i]))) return i;
  return -1;
};

/** A line chart of every third period (non-overlapping three months) plus its yearly table. */
function lineWithTable({ chartId, tableId, periods, series, from, summary, caption, format = rate, tick = tickRate }) {
  const chartIdx = everyNth(periods.length, 3, from);
  createChart($(chartId), { formatValue: format, formatTick: tick, formatX: formatYear }).update({
    labels: chartIdx.map((i) => periods[i].label),
    dates: chartIdx.map((i) => dateOf(periods[i].key)),
    series: series.map((s) => ({ ...s, values: chartIdx.map((i) => s.values[i] ?? null) })),
    summary,
  });
  const tableIdx = everyNth(periods.length, 12, from).reverse(); // newest first
  $(tableId).append(
    renderTable({
      caption,
      head: ['Period', ...series.map((s) => s.label)],
      rows: tableIdx.map((i) => [periods[i].label, ...series.map((s) => s.values[i] ?? null)]),
      format,
    }),
  );
}

startFeature('jobs', (data) => {
  const { lfs, inactive, vacancies } = data;
  const periods = lfs?.periods ?? [];
  const last = periods.length - 1;

  if (last < 0) {
    for (const id of ['rate', 'sexes', 'inactive', 'youth']) $(`${id}-chart`).append(emptyNote());
  }

  // Hero: three headline tiles.
  const vTotal = vacancies?.total ?? [];
  const vPeriods = vacancies?.periods ?? [];
  const vLast = vTotal.length - 1;
  const heroTiles = [];
  if (last >= 0 && ok(lfs.employmentRate[last])) heroTiles.push({ value: rate(lfs.employmentRate[last]), label: `of people aged 16 to 64 in work, ${periods[last].label}` });
  if (last >= 0 && ok(lfs.unemploymentRate[last])) heroTiles.push({ value: rate(lfs.unemploymentRate[last]), label: `of economically active people aged 16 and over unemployed` });
  if (vLast >= 0 && ok(vTotal[vLast])) heroTiles.push({ value: roughly(vTotal[vLast]), label: `vacancies, ${vPeriods[vLast].label}` });
  if (heroTiles.length) $('hero-graphic').append(tiles(heroTiles));

  if (last >= 0) {
    // 1. Fifty years in one line.
    const emp = lfs.employmentRate;
    const now = emp[last];
    if (ok(now)) {
      const clauses = [];
      const prev = last >= 12 ? emp[last - 12] : null;
      if (ok(prev)) {
        const t = tenths(now, prev);
        clauses.push(t === 0 ? `level with ${rate(prev)} a year earlier` : `${t > 0 ? 'up' : 'down'} from ${rate(prev)} a year earlier`);
      }
      // A "record" needs more than a year of history behind it.
      if (last >= 12) {
        const hi = extreme(emp);
        const gap = tenths(emp[hi], now);
        if (gap <= 0) clauses.push(hi === last ? 'the highest on record' : `level with the record first reached in ${periods[hi].label}`);
        else clauses.push(`${points(gap)} below the record of ${rate(emp[hi])} in ${periods[hi].label}`);
      }
      $('rate-summary').textContent = `In ${periods[last].label}, ${rate(now)} of people aged 16 to 64 in the UK were in work${clauses.length ? `, ${list(clauses)}` : ''}.`;
    }
    lineWithTable({
      chartId: 'rate-chart',
      tableId: 'rate-table',
      periods,
      from: 0,
      series: [
        { id: 'employment', label: 'In work', values: lfs.employmentRate, style: 's6' },
        { id: 'inactivity', label: 'Economically inactive', values: lfs.inactivityRate, style: 's2' },
      ],
      summary: `Line chart of the employment and economic inactivity rates of people aged 16 to 64 in the UK, ${periods[0].label} to ${periods[last].label}.`,
      caption: 'Employment and inactivity rates, people aged 16 to 64, UK (the same three months each year)',
    });

    // 2. Women in, men down.
    const men = lfs.menRate;
    const women = lfs.womenRate;
    const f = firstWith(men, women);
    if (f >= 0 && ok(men[last]) && ok(women[last]) && f < last) {
      const wT = tenths(women[last], women[f]);
      const mT = tenths(men[last], men[f]);
      const from = periods[f].label;
      const to = periods[last].label;
      const womenPart =
        wT === 0
          ? `The employment rate for women aged 16 to 64 was ${rate(women[last])} in ${to}, the same as in ${from}.`
          : `The employment rate for women aged 16 to 64 ${wT > 0 ? 'rose' : 'fell'} from ${rate(women[f])} in ${from} to ${rate(women[last])} in ${to}.`;
      const menPart = mT === 0 ? `For men it was unchanged at ${rate(men[last])}.` : `For men it ${mT > 0 ? 'rose' : 'fell'} from ${rate(men[f])} to ${rate(men[last])}.`;
      // Gap in tenths of a point, men minus women; the sign says who is ahead.
      const gapNow = tenths(men[last], women[last]);
      const gapThen = tenths(men[f], women[f]);
      const one = (t) => (Math.abs(t) / 10).toFixed(1);
      let gapSentence;
      if (gapNow === 0) gapSentence = `The two rates are now level, from a gap of ${points(gapThen)}.`;
      else if (Math.sign(gapNow) !== Math.sign(gapThen)) gapSentence = `${gapNow < 0 ? "Women's" : "Men's"} rate is now ${points(gapNow)} above ${gapNow < 0 ? "men's" : "women's"}.`;
      else if (Math.abs(gapNow) === Math.abs(gapThen)) gapSentence = `The gap is unchanged at ${points(gapNow)}.`;
      else gapSentence = `The gap has ${Math.abs(gapNow) < Math.abs(gapThen) ? 'narrowed' : 'widened'} from ${one(gapThen)} percentage points to ${one(gapNow)}.`;
      $('sexes-summary').textContent = `${womenPart} ${menPart} ${gapSentence}`;
    }
    if (f >= 0) {
      lineWithTable({
        chartId: 'sexes-chart',
        tableId: 'sexes-table',
        periods,
        from: f,
        series: [
          { id: 'men', label: 'Men', values: men, style: 's1' },
          { id: 'women', label: 'Women', values: women, style: 's6' },
        ],
        summary: `Line chart of the employment rates of men and women aged 16 to 64 in the UK, ${periods[f].label} to ${periods[last].label}.`,
        caption: 'Employment rate of men and women aged 16 to 64, UK (the same three months each year)',
      });
    } else $('sexes-chart').append(emptyNote());

    // 3. Out of work, not looking.
    const reasons = [
      { id: 'longTermSick', label: 'Long-term sick', words: 'long-term sickness', style: 's6' },
      { id: 'student', label: 'Students', words: 'study', style: 's1' },
      { id: 'familyHome', label: 'Looking after family or home', words: 'looking after family or home', style: 's2' },
      { id: 'retired', label: 'Retired', words: 'retirement', style: 's3' },
      { id: 'temporarySick', label: 'Temporarily sick', words: 'temporary sickness', style: 's4' },
    ].map((r) => ({ ...r, values: inactive?.[r.id] ?? [] }));
    const fi = firstWith(...reasons.map((r) => r.values));
    const lts = reasons[0].values;
    if (fi >= 0 && ok(lts[last])) {
      const parts = [`${roughly(lts[last])} people aged 16 to 64 in the UK were economically inactive because of long-term sickness in ${periods[last].label}`];
      const pre = periods.findIndex((p) => p.key === '2020-01');
      if (pre >= 0 && pre < last && ok(lts[pre])) {
        // Compared at the precision printed, so "up from 2.7 million" never repeats the figure.
        const same = roughly(lts[last]) === roughly(lts[pre]);
        parts[0] += same ? `, level with ${roughly(lts[pre])} in ${periods[pre].label}` : `, ${lts[last] > lts[pre] ? 'up' : 'down'} from ${roughly(lts[pre])} in ${periods[pre].label}`;
      }
      parts[0] += '.';
      const ranked = reasons.filter((r) => ok(r.values[last])).sort((a, b) => b.values[last] - a.values[last]);
      if (ranked.length > 1) {
        const [top, second] = ranked;
        parts.push(
          top.id === 'longTermSick'
            ? `Long-term sickness is now the most common reason, ahead of ${second.words} (${roughly(second.values[last])}).`
            : `The most common reason is now ${top.words} (${roughly(top.values[last])}), ahead of long-term sickness.`,
        );
      }
      $('inactive-summary').textContent = parts.join(' ');
    }
    if (fi >= 0) {
      lineWithTable({
        chartId: 'inactive-chart',
        tableId: 'inactive-table',
        periods,
        from: fi,
        series: reasons.map(({ id, label, values, style }) => ({ id, label, values, style })),
        summary: `Line chart of people aged 16 to 64 in the UK who were economically inactive, by main reason, ${periods[fi].label} to ${periods[last].label}.`,
        caption: 'People aged 16 to 64 economically inactive, by main reason, UK (the same three months each year)',
        format: formatCount,
        tick: tickCount,
      });
    } else $('inactive-chart').append(emptyNote());

    // 4. Young and out of work.
    const youth = lfs.youthUnemploymentRate;
    const all = lfs.unemploymentRate;
    const fy = firstWith(youth);
    if (fy >= 0 && ok(youth[last])) {
      const parts = [`In ${periods[last].label}, ${rate(youth[last])} of economically active 16 to 24-year-olds in the UK were unemployed${ok(all[last]) ? `, against ${rate(all[last])} for everyone 16 and over` : ''}.`];
      const lo = extreme(youth, -1);
      const hi = extreme(youth, 1);
      if (lo !== hi) parts.push(`Since the series began in ${periods[fy].label}, the lowest was ${rate(youth[lo])} in ${periods[lo].label} and the highest ${rate(youth[hi])} in ${periods[hi].label}.`);
      $('youth-summary').textContent = parts.join(' ');
    }
    if (fy >= 0) {
      lineWithTable({
        chartId: 'youth-chart',
        tableId: 'youth-table',
        periods,
        from: fy,
        series: [
          { id: 'youth', label: 'Aged 16 to 24', values: youth, style: 's6' },
          { id: 'all', label: 'All aged 16 and over', values: all, style: 's2' },
        ],
        summary: `Line chart of the unemployment rate of 16 to 24-year-olds and of everyone 16 and over in the UK, ${periods[fy].label} to ${periods[last].label}.`,
        caption: 'Unemployment rate, 16 to 24 and all 16 and over, UK (the same three months each year)',
      });
    } else $('youth-chart').append(emptyNote());
  }

  // 5. Unfilled jobs.
  if (vLast >= 0 && ok(vTotal[vLast])) {
    const lab = vPeriods[vLast].label;
    const early = vPeriods[vLast].flag === 'p' ? ' (early estimate)' : '';
    const clauses = [];
    if (vLast >= 3 && ok(vTotal[vLast - 3])) {
      const d = vTotal[vLast] - vTotal[vLast - 3];
      clauses.push(d === 0 ? 'unchanged on the three months before' : `${d > 0 ? 'up' : 'down'} ${roughly(Math.abs(d))} on the three months before`);
    }
    const pre = vPeriods.findIndex((p) => p.key === '2020-01');
    if (pre >= 0 && pre < vLast && ok(vTotal[pre])) {
      const d = vTotal[vLast] - vTotal[pre];
      clauses.push(`${d === 0 ? 'level with' : d > 0 ? 'above' : 'below'} the ${roughly(vTotal[pre])} of ${vPeriods[pre].label}`);
    }
    const peak = extreme(vTotal);
    const peakSentence =
      vLast < 12 ? '' : peak === vLast ? ` That is the most since the series began in ${vPeriods[0].label}.` : ` The peak was ${roughly(vTotal[peak])} in ${vPeriods[peak].label}.`;
    $('vacancies-summary').textContent = `Employers in the UK reported ${roughly(vTotal[vLast])} vacancies in ${lab}${early}${clauses.length ? `, ${list(clauses)}` : ''}.${peakSentence}`;

    lineWithTable({
      chartId: 'vacancies-chart',
      tableId: 'vacancies-table',
      periods: vPeriods,
      from: 0,
      series: [{ id: 'total', label: 'Vacancies', values: vTotal, style: 's6' }],
      summary: `Line chart of vacancies in the UK, ${vPeriods[0].label} to ${lab}.`,
      caption: 'Vacancies, UK (the same three months each year)',
      format: formatCount,
      tick: tickCount,
    });
  } else $('vacancies-chart').append(emptyNote());

  const industries = (vacancies?.industries ?? []).filter((d) => ok(d.latest)).sort((a, b) => b.latest - a.latest);
  if (industries.length === 0) {
    $('industry-chart').append(emptyNote());
  } else {
    const parts = [];
    const top = industries[0];
    if (vLast >= 0 && ok(vTotal[vLast]) && vTotal[vLast] > 0 && industries.length > 1) {
      const share = top.latest / vTotal[vLast];
      const words = oneIn(share);
      parts.push(`${top.name} had the most vacancies in ${vPeriods[vLast].label}: ${formatCount(top.latest)}, ${words ? `about ${words}` : `${formatPercent(share)} of the total`}.`);
    }
    const compared = industries.filter((d) => ok(d.prePandemic));
    if (compared.length > 1) {
      const k = compared.filter((d) => d.latest < d.prePandemic).length;
      const n = compared.length;
      const preIdx = vPeriods.findIndex((p) => p.key === '2020-01');
      const when = preIdx >= 0 ? vPeriods[preIdx].label : 'December 2019 to February 2020';
      parts.push(
        k === 0
          ? `None of the ${n} industries is below its level of ${when}.`
          : k === n
            ? `All ${n} industries are below their level of ${when}.`
            : NUMBER_WORDS[k]
              ? `${NUMBER_WORDS[k]} of ${n} industries are below their level of ${when}.`
              : `Of ${n} industries, ${k} are below their level of ${when}.`,
      );
    }
    $('vacancies-industry-summary').textContent = parts.join(' ');

    const scale = Math.max(...industries.map((d) => Math.max(d.latest, d.prePandemic ?? 0)));
    $('industry-chart').append(
      markedBars(
        industries.map((d) => ({ label: d.name, value: d.latest, text: formatCount(d.latest), mark: d.prePandemic, markText: ok(d.prePandemic) ? formatCount(d.prePandemic) : '' })),
        scale,
        'before the pandemic',
        'mag-bars',
      ),
    );

    // A change is a percentage only where the industry has enough vacancies for one to mean much.
    const steady = (d) => ok(d.peak) && d.latest >= 0.1 * d.peak && d.latest >= 5000;
    const changeText = (d) => {
      if (!ok(d.prePandemic) || d.prePandemic === 0) return '–';
      if (!steady(d)) return 'levels only';
      const c = d.latest / d.prePandemic - 1;
      const pct = Math.round(c * 100);
      return pct === 0 ? '0%' : `${pct > 0 ? '+' : '−'}${Math.abs(pct)}%`;
    };
    const table = renderTable({
      caption: 'Vacancies by industry, latest period, against December 2019 to February 2020',
      head: ['Industry', 'Latest', 'Dec 2019 to Feb 2020', 'Change', 'Highest', 'Highest in', 'Job openings rate'],
      rows: industries.map((d) => [d.name, d.latest, d.prePandemic ?? null, changeText(d), d.peak ?? null, d.peakLabel ?? '–', ok(d.openingsRate) ? formatPercent(d.openingsRate) : 'not published']),
    });
    for (const tr of table.querySelectorAll('tbody tr')) [3, 6].forEach((c) => tr.children[c]?.classList.add('govuk-table__cell--numeric'));
    $('industry-table').append(table);
  }
});
