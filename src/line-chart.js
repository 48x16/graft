// Line chart over time (or any numeric x), one line per series, with a legend, direct labels,
// a tooltip, and arrow-key focus. Each series' style comes from .mag-line--<style> (s1 to s6),
// so identity never rests on colour alone: greys differ by dash pattern, and lines carry
// direct labels. Pass `style` on a series (defaults to s1, s2 … in order).

import {
  axisBottom,
  axisLeft,
  bisector,
  format,
  line,
  max,
  pointer,
  scaleLinear,
  scaleUtc,
  select,
  utcFormat,
  utcYear,
} from 'd3';
/** The sum of every series at point i, or null if any is unknown. */
const totalAt = (series, i) => series.reduce((sum, s) => (sum === null || s.values[i] === null ? null : sum + s.values[i]), 0);

const HEIGHT = 340;
const NARROW = 520;
/** Years from the first date to the last: longer charts get a year label every five years, not two. */
const yearsShown = (dates) => (dates.at(-1) - dates[0]) / (365.25 * 24 * 3600 * 1000);
const LABEL_GAP = 16;
const count = new Intl.NumberFormat('en-GB');
const tickCount = format('.3~s');
const year = utcFormat('%Y');

export const formatCount = (v) => (v === null ? 'Not published' : count.format(v));

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/** Keys a series in the legend and tooltip with a short stroke in its own style. */
function seriesKey(style) {
  const svg = select(document.createElementNS('http://www.w3.org/2000/svg', 'svg'))
    .attr('class', 'mag-key')
    .attr('viewBox', '0 0 24 8')
    .attr('aria-hidden', 'true');
  svg.append('line').attr('class', `mag-line mag-line--${style}`).attr('x1', 1).attr('x2', 23).attr('y1', 4).attr('y2', 4);
  return svg.node();
}

/**
 * `formatValue` and `formatTick` format tooltip values and y-axis ticks; `totalLabel` names
 * the tooltip's total row (off by default: only add series that really sum, never shares).
 * The x axis is time by default; `formatX` makes it numeric (e.g. ages), with ticks so formatted.
 */
export function createChart(
  root,
  { formatValue = formatCount, formatTick = tickCount, totalLabel = null, formatX = null } = {},
) {
  const legend = el('ul', 'mag-legend');
  const frame = el('div', 'mag-chart__frame');
  const tooltip = el('div', 'mag-tooltip');
  tooltip.hidden = true;
  tooltip.setAttribute('aria-live', 'polite');
  const svg = select(frame)
    .append('svg')
    .attr('class', 'mag-chart__svg')
    .attr('role', 'img')
    .attr('tabindex', 0);
  frame.append(tooltip);
  root.classList.add('mag-chart');
  root.replaceChildren(legend, frame);

  let data = null;
  let geometry = null;

  function drawLegend() {
    legend.replaceChildren(
      ...data.plotted.map((s) => {
        const item = el('li', 'mag-legend__item');
        item.append(seriesKey(s.style), el('span', null, s.label));
        return item;
      }),
    );
  }

  function draw() {
    if (!data) return;
    const width = frame.clientWidth;
    const narrow = width < NARROW;
    const directLabels = !narrow && data.plotted.length <= 5;
    const m = { top: 16, right: directLabels ? 156 : 16, bottom: 32, left: 52 };
    const { dates, series, plotted } = data;

    const x = (formatX ? scaleLinear() : scaleUtc())
      .domain([dates[0], dates[dates.length - 1]])
      .range([m.left, width - m.right]);
    const y = scaleLinear()
      .domain([0, max(plotted, (s) => max(s.values)) || 1])
      .nice()
      .range([HEIGHT - m.bottom, m.top]);
    geometry = { x, y, m, width };

    svg.attr('viewBox', `0 0 ${width} ${HEIGHT}`).attr('height', HEIGHT);
    svg.selectAll('*').remove();

    svg
      .append('g')
      .attr('class', 'mag-chart__grid')
      .selectAll('line')
      .data(y.ticks(5))
      .join('line')
      .attr('x1', m.left)
      .attr('x2', width - m.right)
      .attr('y1', (d) => y(d))
      .attr('y2', (d) => y(d));

    svg
      .append('g')
      .attr('class', 'mag-chart__axis')
      .attr('transform', `translate(0,${HEIGHT - m.bottom})`)
      .call(
        formatX
          ? axisBottom(x).ticks(narrow ? 5 : 10).tickFormat(formatX).tickSizeOuter(0)
          : axisBottom(x).ticks(utcYear.every(narrow ? 4 : yearsShown(dates) > 16 ? 5 : 2)).tickFormat(year).tickSizeOuter(0),
      );
    svg
      .append('g')
      .attr('class', 'mag-chart__axis mag-chart__axis--y')
      .attr('transform', `translate(${m.left},0)`)
      .call(axisLeft(y).ticks(5).tickFormat(formatTick).tickSize(0).tickPadding(8))
      .call((g) => g.select('.domain').remove());

    const path = line()
      .defined((v) => v !== null)
      .x((_, i) => x(dates[i]))
      .y((v) => y(v));
    svg
      .append('g')
      .selectAll('path')
      .data(series)
      .join('path')
      .attr('class', (s) => `mag-line mag-line--${s.style}`)
      .attr('d', (s) => path(s.values));

    if (directLabels) drawDirectLabels(plotted, dates, x, y, width - m.right + 8);

    const focus = svg.append('g').attr('class', 'mag-chart__focus').style('display', 'none');
    focus.append('line').attr('class', 'mag-chart__crosshair').attr('y1', m.top).attr('y2', HEIGHT - m.bottom);
    focus
      .selectAll('circle')
      .data(plotted)
      .join('circle')
      .attr('class', (s) => `mag-dot mag-dot--${s.style}`)
      .attr('r', 4);

    // The pointer only needs to be nearest a point in time, never on a line.
    svg
      .append('rect')
      .attr('class', 'mag-chart__hit')
      .attr('x', m.left)
      .attr('y', m.top)
      .attr('width', Math.max(0, width - m.left - m.right))
      .attr('height', HEIGHT - m.top - m.bottom)
      .on('pointermove', (event) => showFocus(nearestIndex(event)))
      .on('pointerleave', hideFocus);
  }

  function drawDirectLabels(series, dates, x, y, labelX) {
    const last = dates.length - 1;
    const labels = series
      .map((s) => ({ s, y: s.values[last] === null ? null : y(s.values[last]) }))
      .filter((l) => l.y !== null)
      .sort((a, b) => a.y - b.y);
    // Push overlapping labels apart, top to bottom.
    for (let i = 1; i < labels.length; i++) {
      labels[i].y = Math.max(labels[i].y, labels[i - 1].y + LABEL_GAP);
    }
    svg
      .append('g')
      .attr('class', 'mag-chart__labels')
      .selectAll('text')
      .data(labels)
      .join('text')
      .attr('x', labelX)
      .attr('y', (l) => l.y)
      .attr('dy', '0.32em')
      .text((l) => l.s.label);
  }

  function nearestIndex(event) {
    const [px] = pointer(event, svg.node());
    const date = geometry.x.invert(px);
    const i = bisector((d) => d).center(data.dates, date);
    return Math.max(0, Math.min(data.dates.length - 1, i));
  }

  function showFocus(i) {
    data.focusIndex = i;
    const { x, y, width } = geometry;
    const cx = x(data.dates[i]);
    const focus = svg.select('.mag-chart__focus').style('display', null);
    focus.select('.mag-chart__crosshair').attr('x1', cx).attr('x2', cx);
    focus
      .selectAll('circle')
      .attr('cx', cx)
      .attr('cy', (s) => (s.values[i] === null ? -99 : y(s.values[i])));

    renderTooltip(i);
    tooltip.hidden = false;
    const box = tooltip.getBoundingClientRect();
    const left = cx + 12 + box.width > width ? cx - 12 - box.width : cx + 12;
    tooltip.style.left = `${Math.max(0, left)}px`;
    tooltip.style.top = `${geometry.m.top}px`;
  }

  function hideFocus() {
    data.focusIndex = null;
    svg.select('.mag-chart__focus').style('display', 'none');
    tooltip.hidden = true;
  }

  function renderTooltip(i) {
    // Values lead, labels follow: the reader already knows the series and wants the number.
    const row = (value, label, key, modifier = '') => {
      const node = el('div', `mag-tooltip__row ${modifier}`);
      const name = el('span', 'mag-tooltip__label');
      if (key) name.append(key);
      name.append(el('span', null, label));
      node.append(el('span', 'mag-tooltip__value', formatValue(value)), name);
      return node;
    };
    const ordered = [...data.series].sort((a, b) => (b.values[i] ?? -1) - (a.values[i] ?? -1));
    const rows = ordered.map((s) => row(s.values[i], s.label, seriesKey(s.style)));
    if (totalLabel && ordered.length > 1) {
      rows.push(row(totalAt(data.series, i), totalLabel, null, 'mag-tooltip__row--total'));
    }
    tooltip.replaceChildren(el('p', 'mag-tooltip__title', data.labels[i]), ...rows);
  }

  // Keyboard: focus the chart, then use arrow keys, Home and End to move between points.
  svg.on('focus', () => showFocus(data.dates.length - 1));
  svg.on('blur', hideFocus);
  svg.on('keydown', (event) => {
    const last = data.dates.length - 1;
    const current = data.focusIndex ?? last;
    const next = { ArrowLeft: current - 1, ArrowRight: current + 1, Home: 0, End: last }[event.key];
    if (next === undefined) return;
    event.preventDefault();
    showFocus(Math.max(0, Math.min(last, next)));
  });

  new ResizeObserver(() => draw()).observe(frame);

  return {
    /**
     * `labels` name each point ("2024 Q2", "Year ending June 2025"), `dates` place it on the
     * x axis (Dates, or numbers with `formatX`), `series` are { id, label, values, style? }
     * (values null where unknown), and `summary` is the chart's accessible name: one sentence
     * saying what it shows. Every chart also needs a table twin (renderTable in charts.js).
     */
    update({ labels, dates, series, summary }) {
      const styled = series.map((s, i) => ({ ...s, style: s.style ?? `s${(i % 5) + 1}` }));
      data = { labels, dates, series: styled, plotted: styled, focusIndex: null };
      svg.attr('aria-label', summary);
      tooltip.hidden = true;
      drawLegend();
      draw();
    },
  };
}
