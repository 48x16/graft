// The one place a page is wired in. vite.config.js reads it for the build inputs and the
// service worker; build/layout.js for every page's head, header, nav, footer and card lists;
// src/shell.js for the phone's bottom bar; e2e/pages.spec.js and test/site.test.js for checks.
//
// A page: { file, kind: 'feature' | 'tool', title, standfirst, icon, sources, ready }
// - icon: a Lucide icon name in kebab case (https://lucide.dev/icons), e.g. 'briefcase'.
// - sources: ids from `sources` below; the footer credits each one.
// - ready: a selector that exists only once the page's data has drawn (the e2e test waits on it).

export default {
  name: 'Graft',
  tagline: 'Who works, who arrives, and what the official figures say.',
  subject: 'Work and immigration',
  /** Who publishes the data, for the "not affiliated with" line in the footer. */
  publishers: [],
  sources: {
    example: {
      publisher: 'Example publisher',
      title: 'Example dataset',
      url: 'https://www.gov.uk/',
      licence: 'ogl',
    },
  },
  pages: [
    {
      file: 'example.html',
      kind: 'feature',
      title: 'An example story',
      standfirst: 'How a page is put together, on made-up figures. Delete it once a real page exists.',
      icon: 'newspaper',
      sources: ['example'],
      ready: '#trend-table tbody tr',
    },
  ],
};
