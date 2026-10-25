# ONS: VACS02 Vacancies by industry
- Page: https://www.ons.gov.uk/employmentandlabourmarket/peoplenotinwork/unemployment/datasets/vacanciesbyindustryvacs02
  File: https://www.ons.gov.uk/file?uri=/employmentandlabourmarket/peoplenotinwork/unemployment/datasets/vacanciesbyindustryvacs02/current/vacs02oct2026.xlsx. The file name changes every month (`vacs02<mon><yyyy>.xlsx`), so scrape the page for the `current/…xlsx` href rather than hard-coding it.
  Licence: OGL v3.0   Updates: monthly with the Labour market overview (next: 17 November 2026)
- Coverage: UK, Apr–Jun 2001 to Jul–Sep 2026 (303 rolling three-month periods). Excludes agriculture, forestry and fishing (SIC A), households as employers (T) and employment agencies (division 78).
- Files (in .cache/ons-vacancies/): `vacs02oct2026.xlsx`: two sheets, 199 KB
- Status: from the ONS Vacancy Survey, a business survey (not the LFS). The latest period is marked `(p)` (provisional); revised periods are marked `(r)`.

## Tables
**`levels`** (324 rows). The xlsx.js reader handles it.
- Row 3: industry names, with embedded line breaks and footnote digits stuck on (`All vacancies1 `, `Manu- facturing`, `Real estate activities2`, `Administra-tive & support service activities 3`). Clean them, or better, label from the SIC letters.
- Row 4: SIC 2007 section codes: `B-S` (all), `B` … `S`, then `G-S` (total services), `45` (motor trades), `46` (wholesale), `47` (retail).
- Row 5: CDIDs (`AP2Y` = all vacancies, `JP9H` … `JP9Z`, …).
- Rows 8 to 311: one row per rolling three-month period. Col A is a label like `Apr-Jun 2001` or `Nov-Jan 2025` (the year belongs to the *last* month). Col B is a flag (`(r)`, `(p)` or blank). Cols C onward hold the level in **thousands**, as whole numbers.
- 18 industry sections (B to S), 3 subtotal/aggregate columns (B-S, G-S, and 45/46/47, which split G). **Don't add G-S or 45–47 to the section bars**: they're totals and sub-divisions, and you'd double count.
- Rows 313 to 317: change on quarter and on year, absolute and %. These are summary rows mixed in under the data: stop at the first blank row.
- Footnotes at rows 319+. D (electricity) and L (real estate) are not seasonally adjusted (no seasonality); everything else is SA.

**`job openings rate`** (323 rows): same layout. Vacancies as a % of (vacancies + employee jobs), with CDIDs `N4JE` …
- **New measure from September 2026**: the "job openings rate" replaced "vacancies per 100 jobs" and uses timelier employee-jobs denominators. ONS publishes comparisons in the 18 August 2026 edition. Say "job openings rate (a new ONS measure from September 2026)".

No suppression markers in the data (I found no non-numeric cells). The rate sheet's notes define `..` as data unavailable.

## Headline figures (checked)
- All vacancies, Jul–Sep 2026 = **691** thousand. Bulletin: "decrease of 21,000 (2.9%) to 691,000". The sheet's change-on-quarter row says −21 / −2.9 ✓
- Change on year = **−37** thousand, −5.1% (bulletin: 37,000, 5.1%) ✓
- The same figure is AP2Y in lms.csv (`2026 AUG`), so it can be cross-checked in the pipeline.

## Stories this could tell
- **Back below where it was before the pandemic.** Total vacancies are 691,000, against 808,000 in Dec–Feb 2020 and a peak of 1,294,000 in Apr–Jun 2022. ONS notes the last time outside the pandemic it was this low was 2014. Show it as a line with the 2022 peak marked.
- **Hospitality's hiring cooled the most.** Accommodation and food has 70,000 vacancies, down from 177,000 at its peak (Apr–Jun 2022) and 90,000 before the pandemic. Arts and entertainment went from 37,000 to 12,000. Rank industries by the latest level against their *own* peak: that's a fair relative rule for small sections like mining (2,000).
- **Health and social work: the biggest recruiter.** It has 122,000 vacancies, about one in six of the total. That's below its pre-pandemic 137,000 and its 216,000 peak (May–Jul 2022). Write both branches ("above/below pre-pandemic") from the data. This is the natural bridge to the Health and Care Worker visa story (`ho-work-occupation`), as context, not cause.
- **Where vacancies sit relative to the workforce.** The job openings rate (2.1% overall) lets a small sector be compared with a large one: mining 3.3% and finance 2.9%, against education 1.5% and arts 1.4%.

## Traps
- **Rolling, overlapping periods.** Compare with three months back (non-overlapping), as the sheet's own change rows do.
- **The latest period is provisional `(p)`**, and the previous three are revised `(r)`. Say "early estimate" for the latest.
- **Rounded to thousands**: small sections (B, D, E) show 1 to 8, so a "23% rise" in mining is 0 to 2 thousand. Guard percentage-change sentences with a minimum size, relative to the series' own scale.
- **Agriculture isn't covered**, and neither are employment agencies. Say "excludes agriculture, forestry and fishing".
- **Vacancies are not jobs filled** and say nothing about who fills them. Don't link them to visa numbers with "because".
- The job openings rate is a new definition from September 2026. Don't compare it with older "per 100 jobs" figures quoted elsewhere.
