// The building blocks of a story section: numbers in words, bar rows, heat tables, tiles and a
// table twin for every chart. Data is always set with textContent, never innerHTML.

const count = new Intl.NumberFormat('en-GB');
const percent = new Intl.NumberFormat('en-GB', { style: 'percent', maximumFractionDigits: 0 });
const percent1 = new Intl.NumberFormat('en-GB', { style: 'percent', minimumFractionDigits: 1, maximumFractionDigits: 1 });
const signed = new Intl.NumberFormat('en-GB', { style: 'percent', maximumFractionDigits: 0, signDisplay: 'always' });

/** 12,345 (or "not published" for a suppressed figure). */
export const formatCount = (v) => (v === null || v === undefined ? 'not published' : count.format(v));
/** 42% (whole numbers), or 4.2% under 10%, where the decimal matters. */
export const formatPercent = (v) => (Math.abs(v) < 0.1 ? percent1.format(v) : percent.format(v));
/** +12% / −3%. */
export const formatChange = (v) => signed.format(v);
/** 1.2 million, 175,000, 12,345: rounded for prose (2 s.f. in millions, the nearest 1,000 from 10,000). */
export function roughly(v) {
  if (Math.abs(v) >= 1e6) return `${Number((v / 1e6).toPrecision(2))} million`;
  if (Math.abs(v) >= 1e4) return count.format(Math.round(v / 1e3) * 1e3);
  return count.format(v);
}

const WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
/** "one in seven" from a share (0.14), or null when it isn't close to one in a whole number. */
export function oneIn(share) {
  if (!share) return null;
  const n = Math.round(1 / share);
  if (n < 2 || Math.abs(1 / n - share) / share > 0.08) return null;
  return `one in ${WORDS[n] ?? count.format(n)}`;
}
/** "twice", "three times" … from a ratio, or null under 1.5. */
export function times(ratio) {
  if (ratio < 1.5) return null;
  if (ratio < 2.25) return 'twice';
  const n = Math.round(ratio);
  return `${WORDS[n] ?? count.format(n)} times`;
}
/** Lower-cases only the first letter, for a name mid-sentence ("VIN" and "UK" stay as they are). */
export const lower = (s) => (/^[A-Z][a-z]/.test(s) ? s[0].toLowerCase() + s.slice(1) : s);
/** "a, b and c". */
export const list = (items) => (items.length < 2 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`);

export function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

export const hidden = (text) => el('span', 'govuk-visually-hidden', text);

/** Says so when a list has nothing in it (the fixture data, or a quiet period). */
export const emptyNote = (tag = 'p', text = 'Nothing meets the criteria in this data.') => el(tag, 'mag-empty govuk-body', text);

/**
 * Horizontal bars, one row per item: { label, value, text? }. `scale` is the value of a full
 * bar (usually the largest). The figure is printed on every row, so no value rests on length alone.
 */
export function bars(rows, scale, className = 'mag-bars') {
  if (rows.length === 0) return emptyNote();
  const ol = el('ol', className);
  for (const r of rows) {
    const li = el('li', 'mag-bar');
    const track = el('span', 'mag-bar__track');
    track.setAttribute('aria-hidden', 'true');
    const fillBar = el('span', 'mag-bar__fill');
    fillBar.style.width = `${Math.max(0, Math.min(r.value / (scale || 1), 1)) * 100}%`;
    track.append(fillBar);
    li.append(el('span', 'mag-bar__name', r.label), track, el('span', 'mag-bar__value', r.text ?? formatCount(r.value)));
    ol.append(li);
  }
  return ol;
}

/**
 * `bars`, plus a pink marker on each row at `mark` (a comparison: last year, the national
 * figure), said in hidden text as "(<markLabel> <markText>)". Rows without a mark get none.
 */
export function markedBars(rows, scale, markLabel, className) {
  const listNode = bars(rows, scale, className);
  if (rows.length === 0) return listNode;
  [...listNode.children].forEach((li, i) => {
    const { mark, markText } = rows[i];
    if (mark === null || mark === undefined) return;
    const pin = el('span', 'mag-bar__average');
    pin.style.left = `${Math.min(mark / (scale || 1), 1) * 100}%`;
    li.querySelector('.mag-bar__track').append(pin);
    li.querySelector('.mag-bar__value').append(hidden(` (${markLabel} ${markText})`));
  });
  return listNode;
}

/** Headline tiles: [{ value: '1.2 million', label: 'people …' }]. The first gets the pink rule. */
export function tiles(items) {
  const ul = el('ul', 'mag-tiles');
  for (const t of items) {
    const li = el('li', 'mag-tile');
    li.append(el('span', 'mag-tile__value', t.value), el('span', 'mag-tile__label', t.label));
    ul.append(li);
  }
  return ul;
}

/**
 * A table, in a "Show the data as a table" <details> unless `open`. `head` is the header row;
 * `rows` are arrays of cells (numbers are formatted and right-aligned).
 */
export function renderTable({ caption, head, rows, open = false, format = formatCount }) {
  const table = el('table', 'govuk-table');
  table.append(el('caption', 'govuk-table__caption govuk-table__caption--s', caption));
  const thead = el('thead', 'govuk-table__head');
  const hr = el('tr', 'govuk-table__row');
  head.forEach((h, i) => {
    const th = el('th', `govuk-table__header${i ? ' govuk-table__header--numeric' : ''}`, h);
    th.scope = 'col';
    hr.append(th);
  });
  thead.append(hr);
  const tbody = el('tbody', 'govuk-table__body');
  for (const r of rows) {
    const tr = el('tr', 'govuk-table__row');
    r.forEach((c, i) => {
      if (i === 0) {
        const th = el('th', 'govuk-table__header', String(c));
        th.scope = 'row';
        tr.append(th);
      } else {
        tr.append(el('td', `govuk-table__cell${typeof c === 'number' || c === null ? ' govuk-table__cell--numeric' : ''}`, typeof c === 'number' || c === null ? format(c) : c));
      }
    });
    tbody.append(tr);
  }
  table.append(thead, tbody);
  const scroll = el('div', 'mag-table-scroll');
  scroll.setAttribute('role', 'region');
  scroll.setAttribute('aria-label', `${caption} (scrolls sideways)`);
  scroll.tabIndex = 0;
  scroll.append(table);
  if (open) return scroll;
  const details = el('details', 'govuk-details mag-table-details');
  const summary = el('summary', 'govuk-details__summary');
  summary.append(el('span', 'govuk-details__summary-text', 'Show the data as a table'));
  const body = el('div', 'govuk-details__text');
  body.append(scroll);
  details.append(summary, body);
  return details;
}

const STEPS = 5;
/** Four breaks splitting the values into five groups of about equal size (rounded to 2 s.f.). */
export function quintileBreaks(values) {
  const sorted = values.filter((v) => v !== null && Number.isFinite(v)).sort((a, b) => a - b);
  if (sorted.length === 0) return [];
  const round = (v) => (v === 0 ? 0 : Number(v.toPrecision(2)));
  const breaks = [1, 2, 3, 4].map((i) => round(sorted[Math.floor((i * sorted.length) / STEPS)]));
  return breaks.filter((b, i) => i === 0 || b > breaks[i - 1]);
}

/** Which of the groups a value falls in: 0 (lowest) up to breaks.length (highest). */
export const stepOf = (value, breaks) => breaks.filter((b) => value >= b).length;

/**
 * A heat table: rows × columns of figures, each cell shaded in five greys and showing its
 * figure, so shade is never the only cue. `cells[r][c]` is a number or null.
 */
export function heatTable(table, { caption, rowHead, columns, rows, cells, format = formatCount }) {
  const breaks = quintileBreaks(cells.flat());
  table.className = 'govuk-table mag-heat-table';
  table.replaceChildren(el('caption', 'govuk-table__caption govuk-table__caption--s', caption));
  const head = el('tr', 'govuk-table__row');
  for (const h of [rowHead, ...columns]) {
    const th = el('th', 'govuk-table__header', h);
    th.scope = 'col';
    head.append(th);
  }
  const thead = el('thead', 'govuk-table__head');
  thead.append(head);
  const tbody = el('tbody', 'govuk-table__body');
  rows.forEach((name, r) => {
    const tr = el('tr', 'govuk-table__row');
    const th = el('th', 'govuk-table__header', name);
    th.scope = 'row';
    tr.append(th);
    cells[r].forEach((v) => {
      const td = el('td', 'govuk-table__cell govuk-table__cell--numeric mag-heat__cell', v === null ? '–' : format(v));
      if (v !== null) td.dataset.step = String(stepOf(v, breaks));
      tr.append(td);
    });
    tbody.append(tr);
  });
  table.append(thead, tbody);
}
