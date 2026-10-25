// Shared start-up for story and tool pages: load the page's data, fill in the dates, and show a
// clear message if the data can't be loaded.

import './shell.js';
import { loadFeature } from './data.js';

export const $ = (id) => document.getElementById(id);

/** Fills every element marked with `data-<name>` with `value`. */
export function fill(name, value) {
  for (const node of document.querySelectorAll(`[data-${name}]`)) node.textContent = value;
}

/**
 * Loads public/data/features/<name>.json and calls `render(data)`. Every data file carries
 * `updated` (the latest period, in words), which fills [data-updated] in the credits.
 */
export async function startFeature(name, render) {
  let data;
  try {
    data = await loadFeature(name);
  } catch (err) {
    $('error').hidden = false;
    $('error-message').textContent = navigator.onLine
      ? err.message
      : "You're offline, and this page hasn't been viewed on this device yet, so its data isn't saved.";
    return;
  }
  if (data.updated) fill('updated', data.updated);
  render(data);
}
