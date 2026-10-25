// Shared by every page: fonts, styles, the menu, the phone's bottom bar, the offline badge,
// the back-to-top link and the service worker.

import '@fontsource-variable/inter';
import '@fontsource-variable/inter-tight';
import '@fontsource/ibm-plex-mono/latin-400.css';
import '@fontsource/ibm-plex-mono/latin-600.css';
import './styles/main.scss';
import { ArrowUp, createElement, House, Info, Menu, Newspaper, WifiOff, Wrench, X } from 'lucide';
import { navLinks } from '../build/layout.js';
import site from '../site.config.js';

const ICONS = { house: House, newspaper: Newspaper, wrench: Wrench, info: Info };

function watchConnection() {
  const badge = document.getElementById('offline');
  badge.querySelector('.mag-offline__icon').append(createElement(WifiOff, { 'aria-hidden': 'true' }));
  const update = () => {
    badge.hidden = navigator.onLine;
  };
  addEventListener('online', update);
  addEventListener('offline', update);
  update();
}

// Without JavaScript the link is always shown; with it, only once the header has scrolled away.
function backToTop() {
  const box = document.querySelector('.mag-back-to-top');
  if (!box) return;
  box.querySelector('.mag-back-to-top__icon').append(createElement(ArrowUp, { 'aria-hidden': 'true' }));
  new IntersectionObserver(([entry]) => {
    box.hidden = entry.isIntersecting;
  }).observe(document.getElementById('top'));
}

/** On phones the links fold behind a Menu button. Without JavaScript they simply wrap. */
function menu() {
  const nav = document.getElementById('nav');
  if (!nav) return;
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'mag-menu-button';
  button.setAttribute('aria-controls', 'nav');
  button.setAttribute('aria-expanded', 'false');
  const label = document.createElement('span');
  label.textContent = 'Menu';
  const setOpen = (open) => {
    button.setAttribute('aria-expanded', String(open));
    nav.classList.toggle('mag-nav--open', open);
    button.replaceChildren(createElement(open ? X : Menu, { 'aria-hidden': 'true' }), label);
  };
  button.addEventListener('click', () => setOpen(button.getAttribute('aria-expanded') !== 'true'));
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && button.getAttribute('aria-expanded') === 'true') {
      setOpen(false);
      button.focus();
    }
  });
  setOpen(false);
  nav.before(button);
  document.documentElement.classList.add('mag-js');
}

/** The phone's bottom bar: the header's links, the page you're on marked. Small screens only. */
function bottomBar() {
  const page = location.pathname.split('/').pop() || 'index.html';
  const bar = document.createElement('nav');
  bar.className = 'mag-tabbar';
  bar.setAttribute('aria-label', 'Quick links');
  const list = document.createElement('ul');
  list.className = 'mag-tabbar__list';
  for (const link of navLinks(site)) {
    const item = document.createElement('li');
    const a = document.createElement('a');
    a.className = 'mag-tabbar__link';
    a.href = link.href;
    if (link.file === page || link.owns.includes(page)) a.setAttribute('aria-current', 'page');
    const text = document.createElement('span');
    text.textContent = link.label;
    a.append(createElement(ICONS[link.icon], { 'aria-hidden': 'true' }), text);
    item.append(a);
    list.append(item);
  }
  bar.append(list);
  document.body.append(bar);
}

menu();
bottomBar();
watchConnection();
backToTop();

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch((err) => console.error('Service worker not registered', err));
}
