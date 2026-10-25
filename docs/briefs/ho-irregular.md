# Home Office: Immigration system statistics, illegal entry routes (small boat arrivals)
- Page: https://www.gov.uk/government/statistical-data-sets/immigration-system-statistics-data-tables (section "Illegal entry routes"; formerly "Irregular migration to the UK")   Licence: OGL v3.0 (GOV.UK page footer)   Updates: quarterly; this edition year ending June 2026, published 27 August 2026; next 26 November 2026. The arrival-cohort tables (asylum claims, decisions, NRM referrals of small boat arrivals) update yearly, next May 2027.
- Coverage: UK, 2018 Q1 to 2026 Q2 (arrivals; monthly in IER_02a), 2018 to 2025 (arrival-cohort outcomes); quarterly
- Files (in .cache/ho-irregular/):
  - `illegal-entry-routes-to-the-uk-summary-jun-2026-tables.ods`: IER_01, IER_02a to IER_02d, 34 KB
  - `illegal-entry-routes-to-the-uk-dataset-jun-2026.xlsx`: Data_IER_D01 to Data_IER_D05, 2.6 MB
- Status: official statistics, **not accredited** (every table is marked "Accredited Official Statistics: No"). Air arrivals and UK/port detections are management information ("interpret with caution", note 6). Taken from a live database and revised: January 2025 to March 2026 small boat figures were revised in this edition (note 5).

## Tables
`Data_*` sheets: row 0 title, row 1 header, data from row 2; plain integers, no suppression markers, cells down to 1. Ignore the pivot sheets (`IER_D0x`).

**Data_IER_D01** (15,762 rows): detected arrivals via illegal entry routes.
`Year, Quarter, Method of entry, Nationality, Region, Sex, Age Group, Number of detections`
- Quarter 2018 Q1 to 2026 Q2 (34). Method of entry 4: `Small boat arrivals`, `Inadequately documented air arrivals`, `Recorded detections in the UK`, `Recorded detections at UK ports`.
- Nationality 179 (includes `Refugee`, `Stateless`, `Not currently recorded`); Region 17. Sex 4: Female, Male, Unknown, `Not currently recorded`. Age Group 6: `17 and under`, `18 to 24`, `25 to 39`, `40 and over`, Unknown, `Not currently recorded`.
- Rows are people detected, not boats.

**Data_IER_D02** (7,548 rows): small boat arrivals by whether an asylum claim was raised, by arrival date, 2018 to 2025 Q4.
`Year, Quarter, Asylum claim, Nationality, Region, Applicant type, UASC, Sex, Age Group, Arrivals`
- Asylum claim: `Asylum claim raised` | `No asylum claim raised`. Applicant type includes `N/A - No asylum claim`; note the case variants `Main applicant` / `Main Applicant` across sheets.

**Data_IER_D03** (16,259 rows): initial decisions on those claims, by arrival date (cohort view).
`Year, Quarter, Nationality, Region, Asylum Case Outcome, Asylum Case Outcome Group, Applicant type, UASC, Sex, Age Group, Outcomes`
- Same outcome vocabulary as Asy_D02 (Grant of Protection, Refused, Withdrawn, Administrative Outcome …). Recent cohorts are incomplete (many still awaiting decision).

**Data_IER_D04 / D05**: National Referral Mechanism (modern slavery) referrals and outcomes for small boat arrivals, by arrival date. Columns `Year, Quarter, NRM referral, Nationality, Region, Sex, Age Group, Arrivals` and `Year, Quarter, Nationality, Region, Sex, Age Group, NRM Case Outcome, NRM Case Outcome Group, Referrals`. Probably out of scope for this site.

**Summary tables** (ODS, row 4 = header, data from row 5; `z` = not applicable):
- IER_01: detected arrivals by method, 2018 to 2025 + YE June 2025/2026 + change.
- IER_02a: **small boat arrivals and boats by month**, January 2018 to June 2026. Layout: one row per year per measure ("2025 arrivals", "2025 boats"), columns January…December, Total. Blank cells for months not yet published. "2022 arrivals [Note 9]" carries a note marker in the label: strip `[Note n]`.
- IER_02b: small boat arrivals by nationality (top 20 + "All other nationalities" + "Not currently recorded" + Total).
- IER_02c: by age group and sex (nested rows: age group total, then Male/Female/Unknown).
- IER_02d: of each year's small boat arrivals, how many claimed asylum / were referred to the NRM (2018 to 2025).
- Grant rates for claims from small boat arrivals, by decision date, are in the asylum summary workbook (Asy_02c, Asy_02d) in .cache/ho-asylum/.

## Headline figures (checked)
- Small boat arrivals YE June 2026 = 33,374 from D01 (2025 Q3 to 2026 Q2) = 33,374 in IER_01 and IER_02b; "small boat arrivals accounted for 33,000 (88%)" of "38,000 detected arrivals via illegal entry routes" (release summary page). 33,374 / (33,374 + 2,492 + 1,962 + 258) = 88%.
- Small boat arrivals by calendar year from D01 = IER_01 for every year (299 in 2018 … 45,774 in 2022, 41,472 in 2025).
- Change in the latest year = -23% (IER_01 -0.229); "23% lower than the previous year" (summary page).
- Top five nationalities YE June 2026 (Eritrea 5,875, Sudan 4,191, Afghanistan 4,042, Somalia 3,901, Iran 3,657) = 21,666 = 65% of arrivals; "accounted for two-thirds" (summary page).

## Stories this could tell
1. **The Channel by month and season.** IER_02a gives every month since January 2018 (and boats): arrivals cluster from spring to autumn; the busiest single month on record is August 2022 (8,574). People per boat rose from 7 in 2018 to about 62 in 2025 (41,472 / 672), and 65 in the first half of 2026 (11,884 / 182). A heat table (years x months) suits it; the people-per-boat figure is under-used.
2. **Who arrives has changed.** In 2021 the most common nationalities were Iranian (8,319) and Iraqi (6,117); in 2022 Albanian (12,658) and Afghan (9,088), with Albania then almost disappearing from the top 20 (it is not listed in IER_02b, so use D01 for history); in YE June 2026 Eritrea, Sudan, Afghanistan, Somalia and Iran made up 65%. Somali arrivals rose by 1,680 (to 3,901) while Syrian arrivals fell by 2,943 (to 1,003). Show as published (top nationalities by number), no adjectives.
3. **Almost everyone claims asylum.** Of 2025's small boat arrivals, 79% claimed asylum only and 20% claimed asylum and were referred to the NRM; 1% did neither (IER_02d). Puts small boat arrivals and the asylum system in one picture.
4. **Small boat arrivals are mostly young men, but not only.** YE June 2026: 26,973 male, 5,260 female; 4,993 aged 17 and under (IER_02c). Note ages are as recorded and revised after age assessments, so no year-on-year change is published.
5. **Grant rates for small boat arrivals' claims** (Asy_02c): 48% of initial decisions (cases) in YE June 2026, down from 56%; 3rd country refusals rose from 28 to 1,206. Cross-link to the asylum page.

## Traps
- **Terminology.** The Home Office now calls these "illegal entry routes" (note 1: the term describes the act of entry, and some people go on to claim asylum or be found victims of modern slavery). Use "small boat arrivals" and "detected arrivals"; if the route term is needed, quote it as the Home Office's. Never "illegal migrants/immigrants".
- These are **detections**, not all entries (note 7). Methods aren't comparable with each other; air and detections data are management information.
- Arrivals are by **arrival date**; asylum datasets use **claim/decision date**, so small boat counts differ between IER and Asy_D01a (Asy note 18) and IER_02d totals differ slightly from IER_01 (different extraction dates, note 19). Don't reconcile them in prose.
- Revisions: live database, recent quarters revised every release (this edition revised Jan 2025 to Mar 2026). Calendar 2026 is a half year: compare year ending June.
- 2022 Q3 figures come from casework systems rather than manual records (note 9): a small method break.
- "Not currently recorded" nationality/age/sex is largest for recent quarters (1,140 in YE June 2026) and shrinks as records complete; exclude it from rankings but keep it in totals.
- "Refugee" and "Stateless" appear as nationalities and can move between categories as status changes (note 15).
- Day-by-day counts are a different GOV.UK publication ("Small boat activity in the English Channel"); don't mix them with these quarterly statistics.
- Content rule: the release does not count deaths in these tables; keep it that way (do not bring in other sources).
