# ONS: EMP06 Employment by country of birth and nationality
- Page: https://www.ons.gov.uk/employmentandlabourmarket/peopleinwork/employmentandemployeetypes/datasets/employmentbycountryofbirthandnationalityemp06
  File: `…/employmentbycountryofbirthandnationalityemp06/current/emp06aug2026.xls`. The name changes each quarter: scrape the page for the `current/…xls` href.
  Licence: OGL v3.0   Updates: quarterly (February, May, August, November). This edition was published 18 August 2026; the next is **17 November 2026**.
- Coverage: UK, Jan–Mar 1997 to Apr–Jun 2026, calendar quarters, **not seasonally adjusted**. Levels are for people aged 16+; rates are for ages 16–64.
- Files (in .cache/ons-birth/): `emp06aug2026.xls`: 6 sheets, 209 KB. **Old binary Excel (BIFF8), which `xlsx.js` and `ods.js` cannot read.** See Traps.
- Status: "official statistics" from the Labour Force Survey (not accredited), so the LFS caveats apply in full. The reference file calls this series "experimental". The page itself just says official statistics, so use the page's term. The companion dataset **A12** has unemployment and inactivity by country of birth (also .xls).

## Tables
Four data sheets with an identical layout: `Country of birth levels`, `Country of birth rates`, `Nationality Levels`, `Nationality rates`. There are also `Note` and `Introduction`.
- Row 0: title (`Table EMP06: Employment levels by country of birth: People aged 16 and over (not seasonally adjusted)`). Row 1: publication date as an Excel serial (46252 = 18 Aug 2026; next 46343). Row 4: `United Kingdom (thousands) not seasonally adjusted`.
- Rows 6 to 9: a stacked header. Row 9's column labels (with footnote digits stuck on): `Total1 | UK | Total Non UK | Total EU (EU27)2 | Total non-EU | Total Europe | Total EU (EU27)2 | EU143 | EUA84 | EU25 | Other EU6 | Other Europe (not in EU) | Total Africa | Of which: South Africa | Total Asia | Of which: India | Of which: Pakistan and Bangladesh | Toal America and Oceania | Of which: USA | Of which: Australia and New Zealand` (the typo "Toal" is in the source).
- Row 10: `Dataset identifier code` then CDIDs: levels by country of birth `MGTM, JF6F, JF6G, EQ4Q, EQ4S, FSC2, EQ4Q, JJR3, JJR5, EQ4R, FSC3, FSC4, FSC5, JJS3, FSC6, JJS7, JJS9, FSC7, JJR7, JJS5`; rates by country of birth `LF9D, LFM6, LFM7, EQ4Y, EQ52, …`; nationality levels `MGTM, JF6H, JF6I, EQ4U, EQ4W, …`; nationality rates `LF9D, LFN8, LFN9, EQ54, EQ56, …`. Key on CDIDs. **Total EU (EQ4Q/EQ4U/…) appears twice** (cols D and G), so don't add both.
- Rows 12 to 129: one row per quarter (118 quarters), labels like `Jan-Mar 1997`. **Footnote digits are glued to the year**: `Jan-Mar 20197` (note 7, reweighting step) and `Apr-Jun 20208` … `Oct-Dec 20228` (note 8, pandemic non-response). Parse with `/^([A-Z][a-z]{2})-([A-Z][a-z]{2}) (\d{4})/` and keep the first four digits.
- **Units: the header says thousands, but the cells hold whole people** (e.g. 34426383). Divide by 1,000 if you want thousands.
- Markers: `*` = sample too small (early years, small groups); `..` = not available. **From Jan–Mar 2020 onwards, every region below EU / non-EU is `..`.** Today the only usable breakdowns are Total, UK, Non-UK, EU27 and non-EU (the regional detail stops at Oct–Dec 2019).
- Rows 131 to 144 are footnotes. Row 142 says: "should not be used as a proxy for flows of foreign migrants into the UK".
- Totals include people who didn't state a country of birth, so Total ≠ UK + Non-UK.

## Headline figures (checked)
- Total in employment, Apr–Jun 2026 (MGTM, NSA) = **34,426,383**, which matches MGTM `2026 Q2` = 34,426 thousand in the October 2026 lms.csv ✓
- Employment rate 16–64, Apr–Jun 2026 (LF9D, NSA) = **75.0%**, which matches LF9D in lms.csv (75.0) ✓
- ONS's bulletin no longer quotes EMP06 figures in its summary, so the cross-check against LMS is the best available.

Apr–Jun of each year (same quarter, as ONS advises), levels in thousands / rates in %:

| Apr–Jun | UK-born in work | Non-UK-born in work | of which EU27 / non-EU | Rate UK-born | Rate non-UK-born |
|---|---|---|---|---|---|
| 1997 | 24,468 | 1,975 | 652 / 1,323 | 71.7 | 61.9 |
| 2008 | 25,879 | 3,756 | 1,298 / 2,458 | 73.4 | 68.0 |
| 2016 | 26,261 | 5,406 | 2,335 / 3,071 | 74.7 | 72.2 |
| 2019 | 27,083 | 5,793 | 2,447 / 3,346 | 76.2 | 74.4 |
| 2024 | 26,514 | 6,902 | 2,237 / 4,665 | 74.3 | 74.7 |
| 2026 | 26,761 | 7,662 | 2,275 / 5,387 | 74.6 | 76.5 |

## Stories this could tell
- **About one worker in five was born abroad.** Non-UK-born people make up 22% of those in employment (7.66 million of 34.43 million, Apr–Jun 2026), against 7% in 1997 and 13% in 2008. Compute it from the data, and say "people in work", not "jobs".
- **The mix changed after 2016.** Workers born in EU countries number 2.28 million, flat since 2016 (2.34 million). Workers born outside the EU rose from 3.07 million to 5.39 million. This lines up with the post-Brexit visa system (`ho-visas`), but as a parallel, not a cause.
- **The employment-rate gap closed, then flipped.** In 1997, 61.9% of non-UK-born people aged 16–64 were in work, against 71.7% of UK-born people. In Apr–Jun 2026 it's 76.5% against 74.6%. EU-born people have the highest rate (80.9%). Rates have a base (people aged 16–64 in each group), so they're fairer than levels.
- **Country of birth vs nationality.** 7.66 million workers were born abroad, but 5.03 million hold a non-UK nationality: many people born abroad are British citizens. A good explainer panel.
- Sensitivity: show groups as published (UK / non-UK / EU / non-EU), with no ranking language. Never imply that workers born abroad "took" or "displaced" jobs. The UK-born level is mostly about age structure and population, which this table can't show.

## Traps
- **Reading the file.** The pipeline needs a small BIFF8 (.xls) reader. I explored the file with a throwaway one (about 90 lines: compound-file sectors, then the SST, LABELSST, NUMBER, RK, MULRK and FORMULA records), which shows it's feasible with no dependency. The alternative, Nomis APS, only offers country of birth crossed with ethnicity, so it isn't a substitute. The LMS country-of-birth series in lms.csv stop at 2019 Q4.
- **Not seasonally adjusted.** Compare the same quarter across years only (ONS's note at row 144). The latest-on-latest comparison is Apr–Jun 2026 against Apr–Jun 2025.
- **Series breaks and caution periods.** There's a reweighting step change from Jan–Mar 2019 (note 7). ONS advises "extreme caution" for 2020 to 2022 because non-UK-born people stopped responding during the pandemic (note 8). And there's general LFS volatility, especially mid-2023 to 2024 (note 9 and the Note sheet). The method note must say all three, and charts should mark 2020–22 (dashed or shaded, not colour alone).
- **Survey estimates, not counts.** These are sample-based, and small groups are noisy. Don't comment on quarter-to-quarter moves in EU vs non-EU.
- **Not flows.** Employment levels say nothing about arrivals (row 142). Don't combine them with visa grants arithmetically.
- **Rates vs levels use different ages**: levels are 16+, rates are 16–64.
