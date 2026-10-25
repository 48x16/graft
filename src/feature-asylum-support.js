// Support by Area: pick a local authority, see how many people receive asylum support there,
// by type, over time, and against its region and the UK. Per-area counts arrive as
// { n, band }: n is rounded to the nearest 5, or null with band "fewer than 10". Areas are
// never ranked.

import topology from '../data/geo/councils.json';
import { createBubbleMap, sizeKey } from './bubble-map.js';
import { $, startFeature } from './feature-page.js';
import { emptyNote, formatCount, formatPercent, renderTable, tiles } from './charts.js';
import { createChart } from './line-chart.js';
import { loadItem } from './data.js';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
/** "30 June 2023" → a UTC Date. */
function parseDate(text) {
  const [day, month, year] = text.split(' ');
  return new Date(Date.UTC(Number(year), MONTHS.indexOf(month), Number(day)));
}

/** A Count as words: "3,940", or its band ("fewer than 10") when the count is suppressed. */
const countText = (c) => (c.n === null ? c.band ?? 'not published' : formatCount(c.n));
const capital = (s) => s[0].toUpperCase() + s.slice(1);
/** Big enough to say something about (not banded, not zero). */
const sizeable = (c) => c.n !== null && c.n >= 10;
/** A share of the UK, without printing "0.0%" for the smallest areas. */
const shareText = (s) => (s < 0.001 ? 'less than 0.1%' : formatPercent(s));

/** renderTable right-aligns only numbers; banded cells are text but belong in the figure column. */
function alignFigures(node) {
  for (const td of node.querySelectorAll('td')) td.classList.add('govuk-table__cell--numeric');
  return node;
}

startFeature('asylum-support', (index) => {
  const areas = index.areas ?? [];
  const select = $('area-select');
  if (areas.length === 0) {
    select.closest('.govuk-form-group').replaceWith(emptyNote('p', 'No local authorities in this data.'));
    for (const id of ['area-table', 'trend-chart', 'region-tiles']) $(id).append(emptyNote());
    return;
  }
  for (const a of areas) select.append(new Option(a.name, a.slug));

  // The UK map: a circle per area, sized by its (rounded) total; clicking one picks it.
  const byCode = new Map(areas.map((a) => [a.code, a]));
  const map = createBubbleMap($('uk-map'), {
    topology,
    onPick: (code) => {
      if (byCode.has(code)) location.hash = byCode.get(code).slug;
    },
  });
  const total = (a) => a.total ?? { n: 0, band: null };
  const radius = map.update({
    values: new Map(areas.map((a) => [a.code, total(a).n])),
    text: new Map(areas.map((a) => [a.code, `${capital(countText(total(a)))} ${total(a).n === 1 ? 'person' : 'people'}`])),
    label: `Map of the UK with a circle on each local authority, sized by the number of people on asylum support there on ${index.updated}. Every figure is in the table below the map and in the area picker.`,
  });
  const largest = Math.max(0, ...areas.map((a) => total(a).n ?? 0));
  const step = 10 ** Math.floor(Math.log10(Math.max(1, largest)));
  const keyValues = largest >= 1000 ? [100, 1000, Math.floor(largest / step) * step] : largest >= 100 ? [10, 100] : [];
  $('map-key').replaceChildren(sizeKey(radius, [...new Set(keyValues)].filter((v) => v <= largest), formatCount));
  // The map's twin: every area, alphabetical (never ranked).
  $('map-table').replaceChildren(
    alignFigures(
      renderTable({
        caption: `People on asylum support by local authority, ${index.updated}`,
        head: ['Local authority', 'Region', 'People'],
        rows: areas.map((a) => [a.name, a.region, countText(total(a))]),
      }),
    ),
  );
  // Region is text, not a figure: keep it left-aligned.
  for (const tr of $('map-table').querySelectorAll('tbody tr')) tr.children[1]?.classList.remove('govuk-table__cell--numeric');

  const chart = createChart($('trend-chart'), { formatValue: (v) => (v === null ? 'fewer than 10' : formatCount(v)) });
  // Too-small trends get a note instead of a flat line: the table still lists every quarter.
  const tooSmall = emptyNote('p', 'Too few people here to chart: every quarter is under 10.');
  tooSmall.hidden = true;
  $('trend-chart').before(tooSmall);
  let current = 0;

  const slugFromHash = () => {
    const slug = decodeURIComponent(location.hash.slice(1));
    return areas.some((a) => a.slug === slug) ? slug : areas[0].slug;
  };

  async function show(slug) {
    select.value = slug;
    map.highlight(areas.find((a) => a.slug === slug)?.code);
    const ticket = ++current;
    let area;
    try {
      area = await loadItem('asylum-support', slug);
    } catch (err) {
      if (ticket === current) $('area-summary').textContent = err.message;
      return;
    }
    if (ticket === current) render(area);
  }

  select.addEventListener('change', () => {
    location.hash = select.value;
  });
  window.addEventListener('hashchange', () => show(slugFromHash()));
  show(slugFromHash());

  function render(a) {
    const hotels = a.byAccommodation.find((b) => b.type === 'Hotels')?.count ?? { n: 0, band: null };

    // The hero line under the picker: the UK, then the area picked.
    $('hero-summary').textContent =
      a.ukTotal === null || a.ukTotal === undefined
        ? ''
        : `${formatCount(a.ukTotal)} people were on asylum support across the UK on ${a.date}. ${a.total.n === 0 ? `None were in ${a.name}` : `${capital(countText(a.total))} were in ${a.name}`}.`;

    // The area: the sentence, three tiles and the table by type of support.
    let sentence;
    if (a.total.n === 0) sentence = `No one was receiving asylum support in ${a.name} on ${a.date}.`;
    else {
      const share = a.total.n !== null && a.shareOfUk !== null && a.shareOfUk !== undefined ? `: ${shareText(a.shareOfUk)} of the UK total` : '';
      sentence = `${capital(countText(a.total))} people were receiving asylum support in ${a.name} on ${a.date}${share}.`;
      if (a.total.n !== null) {
        if (hotels.n === null) sentence += ` ${capital(countText(hotels))} of them were in hotels.`;
        else if (hotels.n > 0) sentence += ` ${formatCount(hotels.n)} of them were in hotels.`;
      }
    }
    $('area-summary').textContent = sentence;

    const areaTiles = [
      { value: capital(countText(a.total)), label: `people on asylum support, ${a.date}` },
      { value: capital(countText(hotels)), label: 'of them in hotels' },
    ];
    if (a.shareOfUk !== null && a.shareOfUk !== undefined) areaTiles.push({ value: shareText(a.shareOfUk), label: 'of everyone on asylum support in the UK' });
    $('area-tiles').replaceChildren(tiles(areaTiles));
    $('area-table').replaceChildren(
      alignFigures(
        renderTable({
          caption: `People on asylum support in ${a.name} by type, ${a.date}`,
          head: ['Type of support', 'People'],
          rows: [...a.byAccommodation.map((b) => [b.type, countText(b.count)]), ['All support', countText(a.total)]],
          open: true,
        }),
      ),
    );

    // Since 2023: accommodated people and those in hotels, quarter by quarter.
    const { dates, accommodated, hotels: inHotels } = a.trend;
    const last = dates.length - 1;
    if (last < 0) {
      $('trend-summary').textContent = 'Numbers here are too small to describe a trend.';
    } else {
      const first = accommodated[0];
      const latest = accommodated[last];
      if (last > 0 && sizeable(first) && sizeable(latest)) {
        const change = latest.n / first.n - 1;
        const direction = Math.abs(change) < 0.05 ? 'about the same as' : change > 0 ? 'up from' : 'down from';
        $('trend-summary').textContent = `${formatCount(latest.n)} people were in Home Office accommodation in ${a.name} on ${dates[last]}, ${direction} ${formatCount(first.n)} on ${dates[0]}.`;
      } else if (last > 0 && first.n === 0 && sizeable(latest)) {
        $('trend-summary').textContent = `${formatCount(latest.n)} people were in Home Office accommodation in ${a.name} on ${dates[last]}. There were none on ${dates[0]}.`;
      } else if (last > 0 && sizeable(first) && latest.n === 0) {
        $('trend-summary').textContent = `No one was in Home Office accommodation in ${a.name} on ${dates[last]}, down from ${formatCount(first.n)} on ${dates[0]}.`;
      } else {
        $('trend-summary').textContent = 'Numbers here are too small to describe a trend.';
      }
      const chartable = accommodated.some((c) => c.n !== null && c.n >= 10);
      $('trend-chart').hidden = !chartable;
      tooSmall.hidden = chartable;
      chart.update({
        labels: dates,
        dates: dates.map(parseDate),
        series: [
          { id: 'accommodated', label: 'In accommodation', values: accommodated.map((c) => c.n), style: 's1' },
          { id: 'hotels', label: 'In hotels', values: inHotels.map((c) => c.n), style: 's6' },
        ],
        summary: `Line chart of people in Home Office accommodation in ${a.name}, and those of them in hotels, at the end of each quarter from ${dates[0]} to ${dates[last]}.`,
      });
    }
    $('trend-table').replaceChildren(
      last < 0
        ? emptyNote()
        : alignFigures(
            renderTable({
              caption: `People in Home Office accommodation in ${a.name}, each quarter`,
              head: ['Quarter ending', 'In accommodation', 'In hotels'],
              rows: dates.map((d, i) => [d, countText(accommodated[i]), countText(inHotels[i])]),
            }),
          ),
    );

    // The region: exact totals.
    const hasRegion = a.region && a.region !== 'Unknown' && a.regionTotal !== null && a.regionTotal !== undefined;
    $('region-summary').textContent = hasRegion
      ? `${a.region} had ${formatCount(a.regionTotal)} people on asylum support on ${a.date}: ${formatPercent(a.regionTotal / a.ukTotal)} of the UK's ${formatCount(a.ukTotal)}.`
      : '';
    const regionTiles = [];
    if (hasRegion) regionTiles.push({ value: formatCount(a.regionTotal), label: `people on asylum support in ${a.region}` });
    if (a.ukTotal !== null && a.ukTotal !== undefined) regionTiles.push({ value: formatCount(a.ukTotal), label: 'across the UK' });
    $('region-tiles').replaceChildren(regionTiles.length ? tiles(regionTiles) : emptyNote());
  }
});

