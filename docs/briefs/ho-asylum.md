# Home Office: Immigration system statistics, asylum (claims, initial decisions, awaiting a decision, asylum support)
- Page: https://www.gov.uk/government/statistical-data-sets/immigration-system-statistics-data-tables (section "Asylum and resettlement")   Licence: OGL v3.0 (stated in the GOV.UK page footer; workbooks say "Crown copyright")   Updates: quarterly; this edition year ending June 2026, published 27 August 2026; next 26 November 2026
- Coverage: UK, 2001 Q1 to 2026 Q2 (claims and decisions), people awaiting a decision as at 30 Jun 2010 to 30 Jun 2026, support as at 31 Mar 2014 to 30 Jun 2026; quarterly
- Files (in .cache/ho-asylum/):
  - `asylum-summary-jun-2026-tables.ods`: summary tables Asy_00a to Asy_09c (headline series, nationality top 20, grant rates, backlog by duration, small boat outcomes), 0.1 MB
  - `asylum-claims-datasets-jun-2026.xlsx`: Data_Asy_D01 (claims), Data_Asy_D01a (claims by prior route), Data_Asy_D02 (initial decisions), 12.3 MB
  - `asylum-claims-awaiting-decision-datasets-jun-2026.xlsx`: Data_Asy_D03 (stock awaiting a decision), 4.1 MB
  - `asylum-seekers-receipt-support-datasets-jun-2026.xlsx`: Data_Asy_D09 (people on asylum support by nationality, support and accommodation type, UK region), 4.1 MB
  - `support-local-authority-datasets-jun-2026.xlsx`: Data_Asy_D11 (people on asylum support by local authority, with LAD code), 1.4 MB
- Status: accredited official statistics, except claims by prior route (Asy_D01a, Asy_01c to 01e: official statistics in development), and inadmissibility/notices of intent (Asy_02e/02f: management information, provisional). The publisher marks 2026 Q1 onwards as provisional; asylum support from 2018 is described as provisional (Atlas system).

## Tables
All `Data_*` sheets: row 0 is the title, row 1 the header, data from row 2. Long format, one row per combination, all counts are plain integers (no `[c]`/`[x]` markers, no suppression: cells go down to 1). The `Asy_D0x` sheets alongside are Excel pivot tables (last 8 quarters only): ignore them.

**Data_Asy_D01** (86,183 rows): one row = claims for a quarter x nationality x age x sex x applicant type x UASC x location.
`Year, Quarter, Nationality, Region, Age, Sex, Applicant type, UASC, Location of claim, Claims`
- Quarter "2001 Q1" to "2026 Q2" (102). Nationality 211 values; Region 16 (e.g. "Asia Central", "Africa Sub-Saharan", "EU 14").
- Age 8: `Total (pre-2009)`, `17 and under`, `18 to 29`, `30 to 49`, `50 to 69`, `70 and over`, `Unknown Age`, `Unknown age` (two spellings: merge them). Sex 4: `Total (pre-2009)`, Female, Male, `Unknown Sex`.
- Applicant type: `Main Applicant` | `Dependant`. Sum both for "people claiming asylum"; main applicants only = claims (cases). 2001 has main applicants only.
- UASC: `Total (pre-2006)`, `Non-UASC`, `UASC`. Location of claim: `At Port` | `In Country`.

**Data_Asy_D01a** (15,252 rows): people claiming asylum by route before the claim, 2018 Q1 to 2026 Q2.
`Year, Quarter, Nationality, Region, Route prior to claim group, Route prior to claim, Route prior to claim subgroup, Claims`
- Groups: `Illegal Entry Routes` (Small Boat, Clandestine, Entered Without Relevant Documentation), `Visas and Other Leave` (Study Visa, Work Visa with subgroups Graduate / Health and Care Worker / Skilled Worker / Seasonal / Temporary Other / Other, Visitor Visa, Other Leave), `Other`.
- Nationality is `Total (pre-2020)` for 2018-19, and those years are rounded to the nearest 100 (10 under 100). Includes dependants. Official statistics in development.

**Data_Asy_D02** (145,187 rows): initial decisions, by date of decision.
`Year, Quarter, Nationality, Region, Case outcome group, Case outcome, Age, Sex, Applicant type, UASC, Decisions`
- Case outcome group 5: `Grant of Protection`, `Grant of Other Leave`, `Refused`, `Withdrawn`, `Administrative Outcome` (from 2020).
- Case outcome 20 (Refugee Permission, Humanitarian Protection, Temporary Refugee Permission, Discretionary Leave, UASC Leave, Other Grants, Calais Leave, Exceptional Leave to Remain, 3rd Country Refusal, Certified Refusal, Non-Compliance Refusal, Other Refusals, Explicit/Implicit/Other Withdrawal, Admin - Deceased/Other/Void/Suspended, `Total (pre-2010)`).
- **Grant rate** (publisher's definition, note 12): main applicants only, (Grant of Protection + Grant of Other Leave) / (those + Refused). Withdrawals and administrative outcomes excluded.
- Do not publish the `Admin - Deceased` outcome (content rule): it is a handful per quarter; fold it into "administrative outcomes" or drop it.

**Data_Asy_D03** (97,689 rows): stock of claims awaiting a decision, as at quarter end.
`Date (as at...), Nationality, Region, Sex, Applicant type, Application stage, Duration, Claims`
- Dates "30 Jun 2010" to "30 Jun 2026" (65, text). Application stage: `Pending initial decision` | `Pending further review`. Duration 5: `Less than 3 months`, `3 months to less than 6 months`, `6 months to less than 12 months`, `12 months or more`, `N/A - Further review`. Sex includes `Total (Pending further review)`.
- People = all applicant types; cases = Main Applicant. Asy_00a's "people awaiting an initial decision" = `Pending initial decision` rows only. `Pending further review` rows exist only from 30 Jun 2010 to 31 Dec 2022 (5,000 to 9,500 a quarter): always filter them out, or pre-2023 totals are too high.

**Data_Asy_D09** (110,771 rows): people on asylum support, as at quarter end.
`Date (as at…), Nationality, Region, Support Type, Accommodation Type, UK Region / Nation, People`
- Support Type: Section 95, Section 4, Section 98. Accommodation Type 7: Dispersal Accommodation, Subsistence Only, Initial Accommodation, `Contingency Accommodation - Hotel`, `Contingency Accommodation - Other`, Other Accommodation, `N/A - Section 98 (pre-2023)`.
- UK Region / Nation 16, including `Unknown` and several `N/A - …` placeholders.

**Data_Asy_D11** (29,645 rows): people on asylum support by local authority (optional per-area tool).
`Date (as at…), Support Type, UK Region / Nation, Local Authority, LAD Code, Accommodation Type, People`
- 50 dates (31 Mar 2014 to 30 Jun 2026). At 30 Jun 2026: 346 local authorities, all with valid E/W/S/N codes; totals reconcile with D09 (93,293 people; 16,021 in hotels).
- Placeholders before the data existed: `N/A - Section 4 (pre-2018)`, `N/A - Section 98 (pre-Dec 2022)`; subsistence-only has no LA from Dec 2023 to Dec 2024.
- Spelling variants: `Yorkshire and The Humber` / `Yorkshire And The Humber`; `Subsistence Only` / `Subsistence only`. Normalise case.
- LA names follow the boundaries of the time (e.g. Corby, Kettering, Northampton before 2021): use LAD Code and the latest date for a map; for trends, map old codes or restrict to recent years.
- Excludes unaccompanied children supported by local authorities. Northern Ireland only has people who claimed there.

**Summary tables worth reading directly** (ODS; row 5 = header, data from row 6; `z` = not applicable, `:` = not available; rates are fractions, e.g. 0.381):
- Asy_00a: the headline series 2010 to 2025 plus YE June 2025/2026 (claims, decisions, grants, refusals, withdrawals, grant rate, awaiting, appeals to 2022, support, hotels, asylum-related returns).
- Asy_00b: top 20 nationalities for YE June 2026, with claims, decisions, grants, refusals, grant rate (cases), awaiting.
- Asy_03a: people awaiting an initial decision, by duration band.
- Asy_02c / Asy_02d: outcomes and grant rates for claims from small boat arrivals (by outcome date), YE June 2025 vs 2026, top 10 nationalities.
- Asy_04: cohort analysis (final outcomes of each year's claims, including appeals). Asy_06_07 appeals stop in 2023 Q1 (series discontinued).

## Headline figures (checked)
- People claiming asylum, YE June 2026 = 85,891 from D01 (sum of 2025 Q3 to 2026 Q2) = 85,891 in Asy_00a; "86,000 people claimed asylum, 21% less than the previous year" (release summary page). Previous year 108,585.
- People receiving initial decisions YE June 2026 = 115,872 (Asy_00a); "116,000 … 2% more than the previous year" (summary page).
- Grant rate YE June 2026 = 0.381 from D02 main applicants (34,717 protection + 767 other leave vs 57,563 refused) = 0.3814 in Asy_00b; "38% … down from 48% … peak of 77% in YE September 2022" (summary page).
- People awaiting an initial decision at 30 Jun 2026 = 40,168 people / 32,401 cases from D03, matching Asy_00a; peak 175,457 at 30 Jun 2023 from D03; "40,000 people (32,000 cases) … 77% lower than the peak at the end of June 2023 (175,000 people)" (summary page).
- People on asylum support at 30 Jun 2026 = 93,293 (D09 and D11 both), of whom 16,021 in hotels; "93,000 … 16,000 (17%) in hotel accommodation, 50% lower" (summary page).

## Stories this could tell
1. **Decisions caught up with claims.** The number awaiting an initial decision fell from 175,457 people (June 2023) to 40,168 (June 2026); 36% of those still waiting have waited less than 3 months, 27% for 12 months or more (Asy_03a). A clear line chart with a duration stack; useful because the backlog is often quoted out of date.
2. **The grant rate has returned to its 2010s level.** 38% in YE June 2026, after 72% to 76% in 2021-22 (D02 by year), and close to 2010-2019 levels (26% to 52%). Show the full 2001-2026 line so readers see the 2003-05 low (12% to 17%) too. Name it "grant rate at initial decision (main applicants)" and note appeals can change outcomes.
3. **Same countries, very different outcomes.** Among the top nationalities in YE June 2026, grant rates range from over 90% (Sudan 0.92, Yemen 0.93) to under 2% (India, Brazil, Georgia), with Pakistan the most common nationality claiming (8,305) at 0.25 (Asy_00b). Present as published, ranked by number of claims with the rate alongside; no adjectives.
4. **How people arrived before claiming.** About 41% of claimants had previously held a visa or other leave (release summary; Asy_01c/D01a by work/study/visitor visa). Useful and under-reported; label it official statistics in development and say "most recent leave held", not entry route.
5. **Where people on asylum support live (per-area tool).** 93,293 people at June 2026 across 346 local authorities; Glasgow City (3,938), Birmingham (2,136) and Liverpool (1,961) the most; hotel use down by half in a year. A "your area" lookup by LAD code. Needs a population denominator (ONS mid-year estimates, OGL) for per-1,000 rates, otherwise big cities always top the list.
6. **Syria's grant rate.** For Syrian small-boat arrivals, the grant rate at initial decision fell from 0.99 (YE June 2025) to 0.05 (YE June 2026) (Asy_02d). Sensitive: state the measured change only, and if context is given cite the Home Office's own statement (decisions on Syrian claims were paused in December 2024 after the fall of the Assad government); no inference about the people.

## Traps
- **People vs cases.** Claims, decisions and awaiting figures are "people" (main applicants + dependants) in the headline tables; grant rates are on cases (main applicants). Never divide people grants by case refusals.
- Decisions in a year do not relate to that year's claims (note 21). Don't compute "grants / claims".
- Provisional: 2026 Q1 onwards will be revised. The current calendar year (2026) is half a year: use "year ending June" for the latest comparison, never compare 2026 to full years.
- `Unknown Age` / `Unknown age` duplicate category. `Total (pre-2009)`/`Total (pre-2006)` placeholders: filter by them when summing across age/sex/UASC or you get the old years only in one bucket (this is fine for totals but breaks breakdowns before 2009).
- Case outcome definitions changed: Temporary Refugee Permission (Group 2 refugees, NABA 2022) and the Administrative Outcome group (from 2020; deceased split out from 2023). Withdrawals jumped in 2023 (23,213 main applicants): part of the backlog clearance, not a new behaviour.
- Asy_D01a 2018-19 is rounded and nationality-less; its small-boat counts differ from IER tables (date of claim vs date of arrival, note 18).
- Nationality "Refugee" and "Stateless" exist as values; "Other" in summary tables is a residual.
- D11 has no suppression and cells of 1-2 people in small districts; for a public per-area tool round or band small counts (e.g. show "fewer than 10") rather than print single digits. Local authority boundaries change over time.
- Appeals data (Asy_06_07) stops in 2023 Q1: don't chart appeals as current.
