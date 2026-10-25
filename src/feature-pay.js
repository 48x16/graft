// Pay Packet: ASHE full-time medians (UK, regions, occupations) and HMRC PAYE RTI (payrolled
// employees and median monthly pay). Every sentence with a figure is built from the data.

import { $, startFeature } from './feature-page.js';
import { bars, emptyNote, formatPercent, lower, markedBars, renderTable, roughly, tiles } from './charts.js';
import { createChart } from './line-chart.js';
import './styles/pay.scss';

const whole = new Intl.NumberFormat('en-GB', { maximumFractionDigits: 0 });
const pence = new Intl.NumberFormat('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const ok = (v) => v !== null && v !== undefined && Number.isFinite(v);
/** £811 (whole pounds), or "not published". */
const pounds = (v) => (ok(v) ? `£${whole.format(Math.round(v))}` : 'not published');
/** £811.20, for tables. */
const poundsExact = (v) => (ok(v) ? `£${pence.format(v)}` : 'not published');
/** £40,900: rounded to the nearest £100 for prose. */
const poundsRough = (v) => `£${whole.format(Math.round(v / 100) * 100)}`;
const signedPct = (v) => (ok(v) ? `${v > 0 ? '+' : v < 0 ? '−' : ''}${formatPercent(Math.abs(v))}` : 'not published');

/** "up 5.8%" / "down 1.2%" / "unchanged", for a fractional change. */
function upDown(change) {
  if (Math.abs(change) < 0.0005) return 'unchanged';
  return `${change > 0 ? 'up' : 'down'} ${formatPercent(Math.abs(change))}`;
}

/** Region names that take "the" mid-sentence (the North East, the East). */
const place = (name) => (/^(North|South|East|West)\b/.test(name) && name !== 'Northern Ireland' ? `the ${name}` : name);

/** Capitalises the first letter, for a name at the start of a sentence. */
const cap = (s) => s[0].toUpperCase() + s.slice(1);

/** Industry names as they read mid-sentence. */
function industryName(i) {
  if (i.code === 'T-U') return 'households as employers and extraterritorial organisations';
  return lower(i.name);
}

const monthDate = (key) => {
  const [y, m] = key.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, 1));
};
const yearBefore = (key) => {
  const [y, m] = key.split('-');
  return `${Number(y) - 1}-${m}`;
};

startFeature('pay', (data) => {
  const { ashe, rti } = data;
  const months = rti.months ?? [];
  const last = months.length - 1;
  const asheYear = ashe.year;

  if (ashe.provisional) $('ashe-status').textContent = ` The ${asheYear} figures are provisional.`;

  // Hero tiles.
  const heroTiles = [];
  if (ok(ashe.ukFullTimeWeekly)) heroTiles.push({ value: pounds(ashe.ukFullTimeWeekly), label: `a week: UK full-time median, April ${asheYear}` });
  if (ok(ashe.ukFullTimeAnnual)) heroTiles.push({ value: poundsRough(ashe.ukFullTimeAnnual), label: `a year: UK full-time median for the tax year to April ${asheYear}` });
  if (last >= 0 && ok(rti.medianMonthly[last])) heroTiles.push({ value: pounds(rti.medianMonthly[last]), label: `a month: median of all PAYE employees, ${months[last].label} (flash)` });
  $('hero-graphic').append(heroTiles.length ? tiles(heroTiles) : emptyNote());

  // A week's pay.
  const headline = [];
  if (ok(ashe.ukFullTimeWeekly)) {
    const change = ok(ashe.ukFullTimeWeeklyChange) ? `, ${upDown(ashe.ukFullTimeWeeklyChange)} on a year earlier` : '';
    headline.push(`The typical full-time employee in the UK earned ${pounds(ashe.ukFullTimeWeekly)} a week in April ${asheYear}${change}.`);
  }
  if (ok(ashe.ukFullTimeAnnual)) headline.push(`The full-time median for the tax year to April ${asheYear} was ${poundsRough(ashe.ukFullTimeAnnual)}.`);
  if (last >= 0 && ok(rti.medianMonthly[last])) {
    const before = months.findIndex((m) => m.key === yearBefore(months[last].key));
    const change = before >= 0 && ok(rti.medianMonthly[before]) && rti.medianMonthly[before] > 0
      ? `, ${upDown(rti.medianMonthly[last] / rti.medianMonthly[before] - 1)} on a year earlier`
      : '';
    headline.push(`Across all PAYE employees, full-time and part-time, median monthly pay was ${pounds(rti.medianMonthly[last])} in ${months[last].label} (flash estimate)${change}.`);
  }
  $('headline-summary').textContent = headline.join(' ');

  if (months.length >= 2) {
    createChart($('headline-chart'), { formatValue: pounds, formatTick: (v) => `£${whole.format(v)}` }).update({
      labels: months.map((m) => m.label),
      dates: months.map((m) => monthDate(m.key)),
      series: [{ id: 'median', label: 'Median monthly pay', values: rti.medianMonthly, style: 's6' }],
      summary: `Line chart of the median monthly pay of PAYE employees in the UK, ${months[0].label} to ${months[last].label}, before inflation.`,
    });
    $('headline-table').append(
      renderTable({
        caption: 'Median monthly pay of PAYE employees, UK',
        head: ['Month', 'Median monthly pay'],
        rows: months.map((m, i) => [m.label, pounds(rti.medianMonthly[i])]),
      }),
    );
  } else {
    $('headline-chart').append(emptyNote());
  }

  // London and the rest.
  const regions = (ashe.regions ?? []).filter((r) => ok(r.weekly)).sort((a, b) => b.weekly - a.weekly);
  if (regions.length >= 2) {
    const top = regions[0];
    const bottom = regions.at(-1);
    const gap = top.weekly / bottom.weekly - 1;
    const second = regions.length >= 3 ? ` ${cap(place(regions[1].name))} was second, at ${pounds(regions[1].weekly)}.` : '';
    const more = gap < 0.0005 ? `the same as ${place(bottom.name)}, the lowest` : `${formatPercent(gap)} more than ${place(bottom.name)}, the lowest at ${pounds(bottom.weekly)}`;
    $('region-summary').textContent =
      `${cap(place(top.name))} had the highest full-time median in April ${asheYear}, ${pounds(top.weekly)} a week: ${more}.${second}`;
    const scale = Math.max(top.weekly, ok(ashe.ukFullTimeWeekly) ? ashe.ukFullTimeWeekly : 0);
    $('region-bars').append(
      markedBars(
        regions.map((r) => ({ label: r.name, value: r.weekly, text: pounds(r.weekly), mark: ashe.ukFullTimeWeekly, markText: pounds(ashe.ukFullTimeWeekly) })),
        scale,
        'UK median',
      ),
    );
  } else {
    $('region-summary').textContent = 'There are too few published regional figures to compare.';
  }
  if ((ashe.regions ?? []).length) {
    $('region-table').append(
      renderTable({
        caption: `Full-time median gross pay by region of work, April ${asheYear}`,
        head: ['Region', 'Weekly', 'Change on a year earlier', 'Hourly'],
        rows: ashe.regions.map((r) => [r.name, poundsExact(r.weekly), signedPct(r.weeklyChange), poundsExact(r.hourly)]),
        open: regions.length < 2,
      }),
    );
  } else {
    $('region-table').append(emptyNote());
  }

  // The pay ladder.
  const allJobs = ashe.occupations ?? [];
  const jobs = allJobs.filter((o) => ok(o.weekly)).sort((a, b) => b.weekly - a.weekly);
  if (jobs.length >= 2) {
    const n = jobs.length;
    const top = jobs[0];
    const bottom = jobs.at(-1);
    const among = n === allJobs.length ? `Among the ${n} occupation groups` : `Among the ${n} occupation groups with a published figure`;
    let text = `${among}, ${lower(top.name)} had the highest full-time median (${pounds(top.weekly)} a week) and ${lower(bottom.name)} the lowest (${pounds(bottom.weekly)}).`;
    const caringAt = jobs.findIndex((o) => o.code === '61');
    if (caringAt >= 0 && caringAt !== 0 && caringAt !== n - 1) {
      const caring = jobs[caringAt];
      let rank = '';
      if (n >= 8) {
        if (caringAt < n / 4) rank = ', among the highest-paid quarter of groups';
        else if (caringAt < n / 2) rank = ', in the top half';
        else if (caringAt >= n - n / 4) rank = ', among the lowest-paid quarter of groups';
        else rank = ', in the bottom half';
      }
      text += ` ${caring.name} earned ${pounds(caring.weekly)}${rank}.`;
    }
    $('occupation-summary').textContent = text;
    $('occupation-bars').append(bars(jobs.map((o) => ({ label: o.name, value: o.weekly, text: pounds(o.weekly) })), top.weekly, 'mag-bars mag-pay-bars'));
  } else {
    $('occupation-summary').textContent = jobs.length ? '' : 'No occupation figures are published in this data.';
    $('occupation-bars').append(jobs.length ? bars(jobs.map((o) => ({ label: o.name, value: o.weekly, text: pounds(o.weekly) })), jobs[0].weekly, 'mag-bars mag-pay-bars') : emptyNote());
  }
  if (allJobs.length) {
    $('occupation-table').append(
      renderTable({
        caption: `Full-time median gross pay by occupation group, UK, April ${asheYear}`,
        head: ['Occupation group (SOC 2020)', 'Weekly', 'Hourly'],
        rows: allJobs.map((o) => [o.name, poundsExact(o.weekly), poundsExact(o.hourly)]),
      }),
    );
  }

  // Payroll count.
  const payroll = [];
  if (last >= 0 && ok(rti.payrolled[last])) {
    const now = rti.payrolled[last];
    const before = months.findIndex((m) => m.key === yearBefore(months[last].key));
    const feb = months.findIndex((m) => m.key === '2020-02');
    const clauses = [];
    if (before >= 0 && ok(rti.payrolled[before])) {
      const d = now - rti.payrolled[before];
      clauses.push(d === 0 ? 'the same as a year earlier' : `${roughly(Math.abs(d))} ${d > 0 ? 'more' : 'fewer'} than a year earlier`);
    }
    if (feb >= 0 && feb !== last && ok(rti.payrolled[feb])) {
      const d = now - rti.payrolled[feb];
      clauses.push(d === 0 ? 'the same as in February 2020' : `${roughly(Math.abs(d))} ${d > 0 ? 'more' : 'fewer'} than in February 2020`);
    }
    const tail = clauses.length ? `, ${clauses.join(' and ')}` : '';
    payroll.push(`PAYE payrolls in the UK counted ${roughly(now)} employees in ${months[last].label} (flash estimate, seasonally adjusted)${tail}.`);
  }
  const industries = (rti.industries ?? []).filter((i) => ok(i.medianMonthly)).sort((a, b) => b.medianMonthly - a.medianMonthly);
  if (industries.length >= 2) {
    const hi = industries[0];
    const lo = industries.at(-1);
    payroll.push(
      `Median monthly pay by industry ran from ${pounds(lo.medianMonthly)} in ${industryName(lo)} to ${pounds(hi.medianMonthly)} in ${industryName(hi)}. Monthly pay includes part-time work, which pulls some industries down.`,
    );
  }
  $('payroll-summary').textContent = payroll.join(' ');

  if (months.length >= 2) {
    createChart($('payroll-chart')).update({
      labels: months.map((m) => m.label),
      dates: months.map((m) => monthDate(m.key)),
      series: [{ id: 'payrolled', label: 'Payrolled employees', values: rti.payrolled, style: 's6' }],
      summary: `Line chart of the number of payrolled employees in the UK, seasonally adjusted, ${months[0].label} to ${months[last].label}.`,
    });
    $('payroll-table').append(
      renderTable({ caption: 'Payrolled employees, UK, seasonally adjusted', head: ['Month', 'Employees'], rows: months.map((m, i) => [m.label, rti.payrolled[i]]) }),
    );
  } else {
    $('payroll-chart').append(emptyNote());
  }

  const monthLabel = last >= 0 ? months[last].label : '';
  if (industries.length) {
    $('industry-bars').append(
      bars(industries.map((i) => ({ label: i.code === 'T-U' ? 'Households as employers and extraterritorial organisations' : i.name, value: i.medianMonthly, text: pounds(i.medianMonthly) })), industries[0].medianMonthly, 'mag-bars mag-pay-bars'),
    );
    $('industry-table').append(
      renderTable({
        caption: `Median monthly pay of PAYE employees by industry, UK, ${monthLabel}`,
        head: ['Industry (SIC section)', 'Median monthly pay'],
        rows: industries.map((i) => [`${i.code === 'T-U' ? 'Households as employers and extraterritorial organisations' : i.name} (${i.code})`, pounds(i.medianMonthly)]),
      }),
    );
  } else {
    $('industry-bars').append(emptyNote());
  }

  const homeRegions = (rti.regions ?? []).filter((r) => ok(r.medianMonthly));
  if (homeRegions.length) {
    $('home-region-table').append(
      renderTable({
        caption: `Median monthly pay of PAYE employees by region of home, ${monthLabel}`,
        head: ['Region', 'Median monthly pay'],
        rows: homeRegions.map((r) => [r.name, pounds(r.medianMonthly)]),
      }),
    );
  } else {
    $('home-region-table').append(emptyNote());
  }
});
