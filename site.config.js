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
    { file: 'jobs.html', kind: 'feature', title: 'Who Works', standfirst: 'Fifty years of work, worklessness and unfilled jobs, from the official surveys.', icon: 'hard-hat', sources: ['ons-labour', 'ons-vacancies'], ready: '#rate-table tbody tr' },
    { file: 'pay.html', kind: 'feature', title: 'Pay Packet', standfirst: "What a week's work pays, by job and by region, before inflation.", icon: 'banknote', sources: ['ons-pay'], ready: '#region-bars .mag-bar' },
    { file: 'born-abroad.html', kind: 'feature', title: 'Born Abroad', standfirst: 'How many people in work were born outside the UK, and how that mix has shifted.', icon: 'globe', sources: ['ons-birth'], ready: '#share-table tbody tr' },
    { file: 'net-migration.html', kind: 'feature', title: 'In and Out', standfirst: 'How many people came to live in the UK, how many left, and why.', icon: 'arrow-left-right', sources: ['ons-ltim'], ready: '#net-table tbody tr' },
    { file: 'visas.html', kind: 'feature', title: 'Visas Issued', standfirst: 'Who gets a UK visa, what for, and the care worker route that rose and fell.', icon: 'stamp', sources: ['ho-visas', 'ho-work-occupation'], ready: '#groups-table tbody tr' },
    { file: 'asylum.html', kind: 'feature', title: 'Asylum Claims', standfirst: 'Claims, decisions and the queue in between, quarter by quarter.', icon: 'scale', sources: ['ho-asylum'], ready: '#claims-table tbody tr' },
    { file: 'small-boats.html', kind: 'feature', title: 'Boats and Returns', standfirst: 'Small boat arrivals by month, who arrives, and who is returned from the UK.', icon: 'sailboat', sources: ['ho-irregular', 'ho-returns'], ready: '#month-heat tbody tr' },
    { file: 'asylum-support.html', kind: 'tool', title: 'Support by Area', standfirst: 'Find how many people receive asylum support in a local authority.', icon: 'map-pin', sources: ['ho-asylum'], ready: '#area-table tbody tr' },
  ],
};
