// An example story page: hero tiles, a line chart with its table, marked bars and a heat table,
// each with a summary sentence built from the data. Copy its shape; delete it once a real
// page exists (example.html, this file, pipeline/sources/example.js, test/fixtures/example/,
// test/example.test.js and its entries in site.config.js).

import { $, startFeature } from './feature-page.js';
import { bars, formatChange, formatCount, formatPercent, heatTable, markedBars, renderTable, roughly, tiles } from './charts.js';
import { createChart } from './line-chart.js';

startFeature('example', (data) => {
  const { years, applications, grants, groups, regions } = data;
  const last = years.length - 1;

  // Hero: two headline tiles, every figure from the data.
  $('hero-graphic').append(
    tiles([
      { value: roughly(applications[last]), label: `applications in ${years[last]}` },
      { value: formatPercent(grants[last] / applications[last]), label: `granted, the latest year` },
    ]),
  );

  // Over time: the sentence compares the latest year with the first and the peak.
  const peak = applications.indexOf(Math.max(...applications));
  const change = applications[last] / applications[0] - 1;
  $('trend-summary').textContent =
    peak === last
      ? `Applications reached ${formatCount(applications[last])} in ${years[last]}, the most in any year shown, ${formatChange(change)} on ${years[0]}.`
      : `Applications peaked at ${formatCount(applications[peak])} in ${years[peak]}. In ${years[last]} there were ${formatCount(applications[last])}, ${formatChange(change)} on ${years[0]}.`;
  createChart($('trend-chart')).update({
    labels: years.map(String),
    dates: years.map((y) => new Date(Date.UTC(y, 0, 1))),
    series: [
      { id: 'applications', label: 'Applications', values: applications },
      { id: 'grants', label: 'Grants', values: grants },
    ],
    summary: `Line chart of applications and grants each year, ${years[0]} to ${years[last]}.`,
  });
  $('trend-table').append(
    renderTable({ caption: 'Applications and grants each year', head: ['Year', 'Applications', 'Grants'], rows: years.map((y, i) => [String(y), applications[i], grants[i]]) }),
  );

  // Group by group: ranked bars, the year before as a pink marker.
  const ranked = [...groups].sort((a, b) => b.share - a.share);
  if (ranked.length) {
    const top = ranked[0];
    $('ranks-summary').textContent = `${top.name} had the highest share granted, ${formatPercent(top.share)}, against ${formatPercent(top.before)} the year before.`;
  }
  $('ranks-chart').append(
    ranked.length
      ? markedBars(
          ranked.map((g) => ({ label: g.name, value: g.share, text: formatPercent(g.share), mark: g.before, markText: formatPercent(g.before) })),
          1,
          'the year before',
        )
      : bars([], 1),
  );

  // Region by year: a heat table, every cell with its figure.
  const busiest = [...regions].sort((a, b) => b.values.at(-1) - a.values.at(-1))[0];
  if (busiest) $('heat-summary').textContent = `${busiest.name} had the most applications in ${years[last]}: ${formatCount(busiest.values.at(-1))}.`;
  heatTable($('heat-table'), {
    caption: 'Applications by region and year',
    rowHead: 'Region',
    columns: years.map(String),
    rows: regions.map((r) => r.name),
    cells: regions.map((r) => r.values),
  });
});
