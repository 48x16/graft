// A bubble map of the UK's local authorities: the councils drawn as plain land, and a circle on
// each one sized by a count, so big places read big without colouring whole districts. London's
// boroughs crowd together, so they're repeated, spread out, in an inset. Boundaries are in British
// National Grid metres (data/geo/councils.json), so the map needs no projection, only a flip.
//
// The map is for seeing the pattern. Exact figures are in the tooltip, the page's table and its
// area picker, which is how keyboard and screen reader users reach them.

import { geoIdentity, geoPath, pointer, scaleSqrt, select } from 'd3';
import { feature, mesh } from 'topojson-client';

const SVG_NS = 'http://www.w3.org/2000/svg';
const WIDTH = 520;
const MAX_RADIUS = 16;
const SMALL_RADIUS = 2.5;
const isLondon = (code) => code.startsWith('E09');
const isShetland = (code) => code === 'S12000027';

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/**
 * `topology` is data/geo/councils.json. `onPick(code)` is called when a circle is clicked. Call
 * `update()` with the figures, and `highlight(code)` to ring one area in the accent colour.
 */
export function createBubbleMap(root, { topology, onPick }) {
  const all = feature(topology, topology.objects.councils).features;
  // Shetland sits far to the north: drawn in its own box, as on most UK maps, so the rest fills the frame.
  const councils = all.filter((f) => !isShetland(f.properties.code));
  const mainland = { type: 'FeatureCollection', features: councils };
  const main = geoIdentity().reflectY(true).fitWidth(WIDTH, mainland);
  const path = geoPath(main);
  const [[, top], [, bottom]] = path.bounds(mainland);
  const height = Math.ceil(bottom - top) + 2;
  const shetland = { type: 'FeatureCollection', features: all.filter((f) => isShetland(f.properties.code)) };
  const shetlandBox = { x: 1, y: 1, width: WIDTH * 0.12, height: WIDTH * 0.16 };
  const shetlandPath = geoPath(
    geoIdentity()
      .reflectY(true)
      .fitExtent(
        [
          [shetlandBox.x + 4, shetlandBox.y + 4],
          [shetlandBox.x + shetlandBox.width - 4, shetlandBox.y + shetlandBox.height - 4],
        ],
        shetland,
      ),
  );

  // London, enlarged in the empty sea at the top right.
  const london = { type: 'FeatureCollection', features: councils.filter((f) => isLondon(f.properties.code)) };
  const inset = { x: WIDTH * 0.64, y: 1, width: WIDTH * 0.36 - 1, height: WIDTH * 0.28 };
  const insetProjection = geoIdentity()
    .reflectY(true)
    .fitExtent(
      [
        [inset.x + 10, inset.y + 26],
        [inset.x + inset.width - 10, inset.y + inset.height - 8],
      ],
      london,
    );
  const insetPath = geoPath(insetProjection);
  const centre = new Map([...councils.map((f) => [f.properties.code, path.centroid(f)]), ...shetland.features.map((f) => [f.properties.code, shetlandPath.centroid(f)])]);
  const insetCentre = new Map(london.features.map((f) => [f.properties.code, insetPath.centroid(f)]));
  const names = new Map(all.map((f) => [f.properties.code, f.properties.name]));

  const wrap = el('div', 'mag-map');
  const svg = select(document.createElementNS(SVG_NS, 'svg')).attr('class', 'mag-map__svg').attr('viewBox', `0 0 ${WIDTH} ${height}`).attr('role', 'img');
  const tooltip = el('div', 'mag-tooltip mag-map__tooltip');
  tooltip.hidden = true;
  tooltip.setAttribute('aria-hidden', 'true');

  svg.append('path').attr('class', 'mag-map__land').attr('d', path(mainland));
  svg.append('path').attr('class', 'mag-map__borders').attr('d', path(mesh(topology, topology.objects.councils, (a, b) => a !== b && !isShetland(a.properties.code))));
  if (shetland.features.length) {
    svg.append('rect').attr('class', 'mag-map__inset-frame').attr('x', shetlandBox.x).attr('y', shetlandBox.y).attr('width', shetlandBox.width).attr('height', shetlandBox.height);
    svg.append('path').attr('class', 'mag-map__land').attr('d', shetlandPath(shetland));
  }
  const [[lx0, ly0], [lx1, ly1]] = path.bounds(london);
  svg.append('rect').attr('class', 'mag-map__inset-marker').attr('x', lx0 - 3).attr('y', ly0 - 3).attr('width', lx1 - lx0 + 6).attr('height', ly1 - ly0 + 6);
  const bubbles = svg.append('g');
  const box = svg.append('g');
  box.append('rect').attr('class', 'mag-map__inset-frame').attr('x', inset.x).attr('y', inset.y).attr('width', inset.width).attr('height', inset.height);
  box.append('path').attr('class', 'mag-map__land').attr('d', insetPath(london));
  box.append('path').attr('class', 'mag-map__borders').attr('d', insetPath(mesh(topology, topology.objects.councils, (a, b) => a !== b && isLondon(a.properties.code) && isLondon(b.properties.code))));
  box.append('text').attr('class', 'mag-map__inset-label').attr('x', inset.x + 8).attr('y', inset.y + 17).text('London');
  const insetBubbles = box.append('g');
  const raised = svg.append('g');

  wrap.append(svg.node(), tooltip);
  root.replaceChildren(wrap);

  let current = { values: new Map(), text: new Map() };
  let picked = null;
  const circles = new Map(); // code -> [circle elements]

  const showTooltip = (event, code) => {
    tooltip.replaceChildren(el('p', 'mag-tooltip__title', names.get(code) ?? code), el('p', 'mag-map__tooltip-value', current.text.get(code) ?? 'No data'));
    tooltip.hidden = false;
    const [x, y] = pointer(event, wrap);
    tooltip.style.left = `${Math.max(4, Math.min(x + 12, wrap.clientWidth - tooltip.offsetWidth - 4))}px`;
    tooltip.style.top = `${y + 16}px`;
  };

  function highlight(code) {
    picked = code;
    raised.selectAll('*').remove();
    for (const c of circles.get(code) ?? []) {
      raised.append('circle').attr('class', 'mag-map__picked').attr('cx', c.getAttribute('cx')).attr('cy', c.getAttribute('cy')).attr('r', Number(c.getAttribute('r')) + 3);
    }
  }

  return {
    /**
     * `values`: code -> number (0 or missing: no circle; null: a small count shown as a dot),
     * `text`: code -> the figure in words for the tooltip, `label`: the map's accessible name.
     * Returns the radius scale, for a size key.
     */
    update({ values, text, label }) {
      current = { values, text };
      const radius = scaleSqrt().domain([0, Math.max(1, ...[...values.values()].filter((v) => v !== null))]).range([0, MAX_RADIUS]);
      const r = (code) => (values.get(code) === null ? SMALL_RADIUS : Math.max(SMALL_RADIUS, radius(values.get(code))));
      // Largest first, so small circles sit on top and stay clickable.
      const codes = [...values.keys()].filter((c) => centre.has(c) && values.get(c) !== 0).sort((a, b) => (values.get(b) ?? 0) - (values.get(a) ?? 0));
      circles.clear();
      const draw = (group, list, at) =>
        group
          .selectAll('circle')
          .data(list, (c) => c)
          .join('circle')
          .attr('class', (c) => `mag-map__bubble${values.get(c) === null ? ' mag-map__bubble--small' : ''}`)
          .attr('cx', (c) => at.get(c)[0])
          .attr('cy', (c) => at.get(c)[1])
          .attr('r', r)
          .each(function (c) {
            circles.set(c, [...(circles.get(c) ?? []), this]);
          })
          .on('pointermove', (event, c) => showTooltip(event, c))
          .on('pointerleave', () => {
            tooltip.hidden = true;
          })
          .on('click', (_, c) => onPick?.(c));
      draw(bubbles, codes, centre);
      draw(insetBubbles, codes.filter((c) => insetCentre.has(c)), insetCentre);
      svg.attr('aria-label', label);
      if (picked) highlight(picked);
      return radius;
    },
    highlight,
  };
}

/** A size key: a few circles with their figures, so size is never the only cue. */
export function sizeKey(radius, values, format) {
  const key = el('ul', 'mag-map__key');
  for (const v of values) {
    const item = el('li', 'mag-map__key-item');
    const d = Math.ceil(radius(v) * 2) + 2;
    const svg = select(document.createElementNS(SVG_NS, 'svg')).attr('width', d).attr('height', d).attr('aria-hidden', 'true');
    svg.append('circle').attr('class', 'mag-map__bubble').attr('cx', d / 2).attr('cy', d / 2).attr('r', radius(v));
    item.append(svg.node(), el('span', null, format(v)));
    key.append(item);
  }
  const small = el('li', 'mag-map__key-item');
  const svg = select(document.createElementNS(SVG_NS, 'svg')).attr('width', 8).attr('height', 8).attr('aria-hidden', 'true');
  svg.append('circle').attr('class', 'mag-map__bubble mag-map__bubble--small').attr('cx', 4).attr('cy', 4).attr('r', SMALL_RADIUS);
  small.append(svg.node(), el('span', null, 'fewer than 10'));
  key.append(small);
  return key;
}
