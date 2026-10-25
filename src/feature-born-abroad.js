// Born Abroad: ONS Labour Force Survey (EMP06), people in work by country of birth and by
// nationality, the same calendar quarter each year. Every sentence with a figure is built from
// the data. Country of birth and nationality are different measures: each sentence names its own.

import { $, startFeature } from './feature-page.js';
import { bars, emptyNote, formatCount, formatPercent, renderTable, roughly, tiles } from './charts.js';
import { createChart } from './line-chart.js';

const ok = (v) => v !== null && v !== undefined && Number.isFinite(v);
const pct1 = new Intl.NumberFormat('en-GB', { style: 'percent', minimumFractionDigits: 1, maximumFractionDigits: 1 });
/** 76.5%: rates and shares to one decimal, so small gaps never print as equal. */
const rate = (v) => (ok(v) ? pct1.format(v) : 'not published');
const points = new Intl.NumberFormat('en-GB', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const wholePct = new Intl.NumberFormat('en-GB', { style: 'percent', maximumFractionDigits: 0 });
const tickPct = (v) => wholePct.format(v);
const yearDate = (y) => new Date(Date.UTC(y, 0, 1));
const WORDS = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];

/** "2020 to 2022", "2019", or "2019 and 2021" for a list of years. */
function yearSpan(ys) {
  if (ys.length === 0) return '';
  if (ys.length === 1) return String(ys[0]);
  const consecutive = ys.every((y, i) => i === 0 || y === ys[i - 1] + 1);
  return consecutive ? `${ys[0]} to ${ys.at(-1)}` : `${ys.slice(0, -1).join(', ')} and ${ys.at(-1)}`;
}

startFeature('born-abroad', (data) => {
  const years = data.years ?? [];
  const caution = data.caution ?? [];
  const lv = data.levels ?? {};
  const rt = data.rates ?? {};
  const nat = data.nationality ?? {};
  const q = data.quarterLabel ?? 'the same quarter';
  const at = (y) => `${q} ${y}`;
  const get = (arr, i) => (arr && ok(arr[i]) ? arr[i] : null);

  const share = years.map((_, i) => {
    const n = get(lv.nonUkBorn, i);
    const t = get(lv.total, i);
    return n !== null && t !== null && t > 0 ? n / t : null;
  });
  const valid = share.map((s, i) => (s === null ? -1 : i)).filter((i) => i >= 0);
  const last = valid.at(-1);
  const first = valid[0];

  // Method note: the caution years, from the data's own flags.
  const pandemicYears = years.filter((_, i) => caution[i] === 'pandemic');
  const reweightYears = years.filter((_, i) => caution[i] === 'reweight');
  if (reweightYears.length) $('share-reweight').textContent = `Survey weights were revised from ${at(reweightYears[0])}, a step in the series.`;
  if (pandemicYears.length) {
    $('share-pandemic').textContent = `ONS advises extreme caution with country-of-birth figures for ${yearSpan(pandemicYears)} (pandemic non-response); the chart dashes those years.`;
  } else {
    $('share-pandemic').textContent = '';
  }

  // Hero tiles and the h2, from the latest year with a share.
  if (last !== undefined) {
    $('hero-graphic').append(
      tiles([
        { value: formatPercent(share[last]), label: `of people in work were born outside the UK, ${at(years[last])}` },
        { value: roughly(lv.nonUkBorn[last]), label: `people in work born outside the UK, aged 16 and over` },
      ]),
    );
    // The nearest "one in n" for a headline (sentences use exact figures).
    let n = 1;
    for (let k = 2; k <= 10; k++) if (Math.abs(1 / k - share[last]) < Math.abs(1 / n - share[last])) n = k;
    if (n >= 2 && Math.abs(1 / n - share[last]) <= 0.03) $('share-title').textContent = `One in ${WORDS[n]}`;
  } else {
    $('hero-graphic').append(emptyNote());
  }

  // 1. The share.
  if (last !== undefined) {
    const lead = `${roughly(lv.nonUkBorn[last])} of ${roughly(lv.total[last])}`;
    if (first !== last) {
      const [now, then] = [rate(share[last]), rate(share[first])];
      $('share-summary').textContent =
        `${now[0].toUpperCase()}${now.slice(1)}${now.startsWith('one in') ? '' : ' of'} people aged 16 and over in work in the UK in ${at(years[last])} were born outside the UK: ${lead}. ` +
        `In ${at(years[first])} the share was ${then}.`;
    } else {
      const now = rate(share[last]);
      $('share-summary').textContent = `${now} of people aged 16 and over in work in the UK in ${at(years[last])} were born outside the UK: ${lead}.`;
    }
  } else {
    $('share-summary').replaceWith(emptyNote());
  }

  if (valid.length >= 2) {
    // Caution years get their own dashed segment, joined to the years either side.
    const isPandemic = (i) => caution[i] === 'pandemic';
    const solid = share.map((s, i) => (isPandemic(i) ? null : s));
    const dashed = share.map((s, i) => (isPandemic(i) || isPandemic(i - 1) || isPandemic(i + 1) ? s : null));
    const series = [{ id: 'share', label: 'Born outside the UK', values: solid, style: 's6' }];
    if (pandemicYears.length) series.push({ id: 'caution', label: 'Extreme caution years', values: dashed, style: 's2' });
    createChart($('share-chart'), { formatValue: rate, formatTick: tickPct }).update({
      labels: years.map(at),
      dates: years.map(yearDate),
      series,
      summary: `Line chart of the share of people aged 16 and over in work in the UK who were born outside the UK, ${at(years[0])} to ${at(years.at(-1))}${pandemicYears.length ? `, dashed for ${yearSpan(pandemicYears)}` : ''}.`,
    });
  } else {
    $('share-chart').append(emptyNote());
  }
  const note = (c) => (c === 'pandemic' ? 'Extreme caution' : c === 'reweight' ? 'Reweighted: step in series' : '');
  $('share-table').append(
    years.length
      ? renderTable({
          caption: `People aged 16 and over in work by country of birth, UK, ${q} each year`,
          head: ['Year', 'All in work', 'Born outside the UK', 'Share', 'Note'],
          rows: years.map((y, i) => [String(y), get(lv.total, i), get(lv.nonUkBorn, i), rate(share[i]), note(caution[i])]),
        })
      : emptyNote(),
  );

  // 2. EU and beyond.
  const eu = lv.euBorn ?? [];
  const nonEu = lv.nonEuBorn ?? [];
  const both = years.map((_, i) => i).filter((i) => ok(eu[i]) && ok(nonEu[i]));
  const mLast = both.at(-1);
  if (mLast !== undefined && both.length >= 2) {
    const i2016 = years.indexOf(2016);
    const base = both.includes(i2016) && i2016 < mLast ? i2016 : both[0];
    const compare = (now, then) => {
      const change = now / then - 1;
      if (Math.abs(change) < 0.005) return `about the same as in ${at(years[base])}`;
      const was = roughly(then) === roughly(now) ? '' : ` (${roughly(then)})`;
      return `${formatPercent(Math.abs(change))} ${change > 0 ? 'more' : 'fewer'} than in ${at(years[base])}${was}`;
    };
    $('mix-summary').textContent =
      `In ${at(years[mLast])}, ${roughly(eu[mLast])} people in work in the UK were born in the EU, ${compare(eu[mLast], eu[base])}. ` +
      `${roughly(nonEu[mLast])} were born outside both the UK and the EU, ${compare(nonEu[mLast], nonEu[base])}.`;
    createChart($('mix-chart')).update({
      labels: years.map(at),
      dates: years.map(yearDate),
      series: [
        { id: 'eu', label: 'EU born', values: years.map((_, i) => get(eu, i)), style: 's1' },
        { id: 'noneu', label: 'Non-EU born', values: years.map((_, i) => get(nonEu, i)), style: 's6' },
      ],
      summary: `Line chart of people aged 16 and over in work in the UK born in the EU and born outside both the UK and the EU, ${at(years[0])} to ${at(years.at(-1))}.`,
    });
  } else {
    $('mix-summary').replaceWith(emptyNote());
    $('mix-chart').append(emptyNote('p', 'Too few years to draw.'));
  }
  if (years.length) {
    $('mix-table').append(
      renderTable({
        caption: `People aged 16 and over in work born in the EU and outside it, UK, ${q} each year`,
        head: ['Year', 'Born in the EU', 'Born outside the UK and EU'],
        rows: years.map((y, i) => [String(y), get(eu, i), get(nonEu, i)]),
      }),
    );
  }

  // 3. The rate gap.
  const rUk = rt.ukBorn ?? [];
  const rNon = rt.nonUkBorn ?? [];
  const rBoth = years.map((_, i) => i).filter((i) => ok(rUk[i]) && ok(rNon[i]));
  const rLast = rBoth.at(-1);
  if (rLast !== undefined) {
    const gap = (rNon[rLast] - rUk[rLast]) * 100;
    const verdict =
      Math.abs(gap) < 0.5
        ? 'about the same'
        : `${points.format(Math.abs(gap))} percentage points ${gap > 0 ? 'higher' : 'lower'}`;
    const r0 = rBoth[0];
    const then = r0 !== rLast ? ` In ${at(years[r0])} the rates were ${rate(rNon[r0])} and ${rate(rUk[r0])}.` : '';
    $('rates-summary').textContent =
      `${rate(rNon[rLast])} of people aged 16 to 64 born outside the UK were in work in ${at(years[rLast])}, against ${rate(rUk[rLast])} of those born in the UK: ${verdict}.${then}`;
  } else {
    $('rates-summary').replaceWith(emptyNote());
  }
  if (rBoth.length >= 2) {
    createChart($('rates-chart'), { formatValue: rate, formatTick: tickPct, zero: false }).update({
      labels: years.map(at),
      dates: years.map(yearDate),
      series: [
        { id: 'uk', label: 'UK born', values: years.map((_, i) => get(rUk, i)), style: 's1' },
        { id: 'nonuk', label: 'Non-UK born', values: years.map((_, i) => get(rNon, i)), style: 's6' },
        { id: 'eu', label: 'EU born', values: years.map((_, i) => get(rt.euBorn, i)), style: 's2' },
        { id: 'noneu', label: 'Non-EU born', values: years.map((_, i) => get(rt.nonEuBorn, i)), style: 's3' },
      ],
      summary: `Line chart of the employment rate of people aged 16 to 64 in the UK by country of birth (UK, outside the UK, EU, outside the UK and EU), ${at(years[0])} to ${at(years.at(-1))}.`,
    });
  } else {
    $('rates-chart').append(emptyNote('p', 'Too few years to draw.'));
  }
  if (years.length) {
    $('rates-table').append(
      renderTable({
        caption: `Employment rate, people aged 16 to 64, by country of birth, UK, ${q} each year`,
        head: ['Year', 'Born in the UK', 'Born outside the UK', 'Born in the EU', 'Born outside the UK and EU'],
        rows: years.map((y, i) => [String(y), rate(get(rUk, i)), rate(get(rNon, i)), rate(get(rt.euBorn, i)), rate(get(rt.nonEuBorn, i))]),
      }),
    );
  }

  // 4. Born abroad, or not British.
  const nb = lv.nonUkBorn ?? [];
  const nn = nat.nonUk ?? [];
  const nBoth = years.map((_, i) => i).filter((i) => ok(nb[i]) && ok(nn[i]));
  const nLast = nBoth.at(-1);
  if (nLast !== undefined) {
    const a = roughly(nb[nLast]);
    const b = roughly(nn[nLast]);
    $('nationality-summary').textContent =
      nn[nLast] < nb[nLast]
        ? `In ${at(years[nLast])}, ${a} people in work in the UK were born outside the UK, but ${b} held a non-UK nationality. Many people born abroad are British citizens.`
        : `In ${at(years[nLast])}, ${a} people in work in the UK were born outside the UK and ${b} held a non-UK nationality.`;
    $('nationality-heading').textContent = `People aged 16 and over in work, UK, ${at(years[nLast])}`;
    const scale = Math.max(nb[nLast], nn[nLast]);
    $('nationality-chart').append(
      bars(
        [
          { label: 'Born outside the UK', value: nb[nLast], text: formatCount(nb[nLast]) },
          { label: 'Non-UK nationality', value: nn[nLast], text: formatCount(nn[nLast]) },
        ],
        scale,
      ),
    );
  } else {
    $('nationality-summary').replaceWith(emptyNote());
    $('nationality-chart').append(emptyNote());
  }
  if (years.length) {
    $('nationality-table').append(
      renderTable({
        caption: `People aged 16 and over in work, by country of birth and by nationality, UK, ${q} each year`,
        head: ['Year', 'Born outside the UK', 'Non-UK nationality', 'Born in the UK', 'UK nationality'],
        rows: years.map((y, i) => [String(y), get(nb, i), get(nn, i), get(lv.ukBorn, i), get(nat.uk, i)]),
      }),
    );
  }
});
