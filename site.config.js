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
  publishers: ['the Home Office', 'the Office for National Statistics'],
  sources: {
    'ho-visas': { publisher: 'Home Office', title: 'Immigration system statistics: entry clearance visas', url: 'https://www.gov.uk/government/statistical-data-sets/immigration-system-statistics-data-tables', licence: 'ogl' },
    'ho-work-occupation': { publisher: 'Home Office', title: 'Immigration system statistics: sponsored work visas by occupation and industry', url: 'https://www.gov.uk/government/statistical-data-sets/immigration-system-statistics-data-tables', licence: 'ogl' },
    'ho-asylum': { publisher: 'Home Office', title: 'Immigration system statistics: asylum and asylum support', url: 'https://www.gov.uk/government/statistical-data-sets/immigration-system-statistics-data-tables', licence: 'ogl' },
    'ho-irregular': { publisher: 'Home Office', title: 'Immigration system statistics: small boat arrivals', url: 'https://www.gov.uk/government/statistical-data-sets/immigration-system-statistics-data-tables', licence: 'ogl' },
    'ho-returns': { publisher: 'Home Office', title: 'Immigration system statistics: returns', url: 'https://www.gov.uk/government/statistical-data-sets/immigration-system-statistics-data-tables', licence: 'ogl' },
    'ons-ltim': { publisher: 'Office for National Statistics', title: 'Long-term international migration, provisional', url: 'https://www.ons.gov.uk/peoplepopulationandcommunity/populationandmigration/internationalmigration/datasets/longterminternationalimmigrationemigrationandnetmigrationflowsprovisional', licence: 'ogl' },
    'ons-labour': { publisher: 'Office for National Statistics', title: 'Labour market statistics time series', url: 'https://www.ons.gov.uk/employmentandlabourmarket/peopleinwork/employmentandemployeetypes/datasets/labourmarketstatistics', licence: 'ogl' },
    'ons-vacancies': { publisher: 'Office for National Statistics', title: 'Vacancies by industry (VACS02)', url: 'https://www.ons.gov.uk/employmentandlabourmarket/peoplenotinwork/unemployment/datasets/vacanciesbyindustryvacs02', licence: 'ogl' },
    'ons-pay': { publisher: 'Office for National Statistics', title: 'Annual Survey of Hours and Earnings (Table 3) and PAYE Real Time Information', url: 'https://www.ons.gov.uk/employmentandlabourmarket/peopleinwork/earningsandworkinghours/datasets/regionbyoccupation2digitsocashetable3', licence: 'ogl' },
    'ons-birth': { publisher: 'Office for National Statistics', title: 'Employment by country of birth and nationality (EMP06)', url: 'https://www.ons.gov.uk/employmentandlabourmarket/peopleinwork/employmentandemployeetypes/datasets/employmentbycountryofbirthandnationalityemp06', licence: 'ogl' },
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
