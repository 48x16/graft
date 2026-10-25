# Home Office: Immigration system statistics, returns
- Page: https://www.gov.uk/government/statistical-data-sets/immigration-system-statistics-data-tables (section "Returns")   Licence: OGL v3.0 (GOV.UK page footer)   Updates: quarterly; this edition year ending June 2026, published 27 August 2026; next 26 November 2026 (offence-group tables yearly, August 2027)
- Coverage: UK (returns from the UK), 2004 Q1 to 2026 Q2 (all returns), 2010 onwards (asylum-related, foreign national offenders), 2018 Q1 onwards (returns of small boat arrivals); quarterly
- Files (in .cache/ho-returns/):
  - `returns-summary-jun-2026-tables.ods`: Ret_01 to Ret_06b, 66 KB
  - `returns-datasets-jun-2026.xlsx`: Data_Ret_D01 to Data_Ret_D05, 16.3 MB
- Status: accredited official statistics for Ret_01 to Ret_05 and Ret_D01 to D04; **not accredited** for asylum-related returns by nationality (Ret_D05), returns of small boat arrivals (Ret_06a/b) and FNO offence breakdowns (Ret_02c/d). The **latest 7 quarters are provisional** (note 4), marked `[p]` in summary tables.

## Tables
`Data_*` sheets: row 0 title, row 1 header, data from row 2; plain integers, no suppression. Ignore pivot sheets.

**Data_Ret_D01** (266,798 rows): returns by nationality.
`Year, Quarter, Nationality, Region, Return type group, Return type, Age, Sex, Return destination group, Number of returns`
- Quarter 2004 Q1 to 2026 Q2 (90). Nationality 222, Region 16.
- Return type group 3: `Enforced return`, `Voluntary return`, `Refused entry at port and subsequently departed`.
- Return type 12, including both `Non-detained Enforced removals` and `Non-detained enforced removals` (case variant), `Enforced removals` (pre-2010 total), `N/A - pre-2007`, `Departed from UK Ports` / `Departed from Juxtaposed controls` (discontinued after September 2022), `Refused entry at port and subsequently departed`, Assisted / Controlled / Other verified returns, Other returns from detention.
- Age 6 (`17 and under` … `70 and over`, Unknown), Sex 3 (Male, Female, Unknown). Return destination group: `Home country`/`Home Country` (case variant), `EU Member State`, `Other country`.

**Data_Ret_D02** (49,486 rows): returns by destination country. `Year, Quarter, Return destination, Return destination region, Return type group, Return type, Number of returns`.

**Data_Ret_D05** (10,100 rows): asylum-related returns by nationality, 2010 onwards. `Year, Quarter, Nationality, Region, Return type group, Number of asylum-related returns`. "Asylum-related" = there was an asylum claim or further submission at some stage before the return (note 32). Not comparable before/after October 2020 (note 31).

**Data_Ret_D03 / D04**: returns of foreign national offenders by nationality / destination. Sensitive (crime by nationality): recommend not using, or only as a single total with the publisher's definition.

**Summary tables** (ODS; header row 5, data from row 6; `z` not applicable, `:` not available; `[p]` in period labels):
- Ret_01: returns by type, 2004 to 2025 + YE June 2025/2026. Headers: `Data of return` (sic), `Enforced returns, total`, `a. Enforced removals`, `a.i. Enforced removals from detention`, `a.ii. Non-detained enforced removals`, `b. Other returns from detention`, `Voluntary returns, total`, `a. Assisted returns`, `b. Controlled returns`, `c. Other verified returns`, `Refused entry at port and subsequently departed, total`, `a. Departed from UK ports`, `b. Departed from juxtaposed controls`.
- Ret_03: top 10 nationalities by return type, **three tables side by side** in one sheet (enforced, voluntary, refused at port; columns A–E, F–J, K–O). Ret_04: by asylum / non-asylum.
- Ret_05: returns by type split asylum / non-asylum, 2010 onwards (headers have leading spaces: `" Asylum"`, `"  Asylum"`; trim).
- Ret_06a: returns of small boat arrivals by quarter, 2018 Q1 to 2026 Q2, with `YYYY Total` rows interleaved and the last row `2026 (Jan - Jun)`: filter to `^\d{4} Q\d` rows. Ret_06b: top 10 nationalities, YE June 2026.

## Headline figures (checked)
- Enforced returns YE June 2026 = 9,669 from D01 (2025 Q3 to 2026 Q2) = 9,669 in Ret_01; voluntary 30,936 = 30,936; refused entry at port and departed 18,646 = 18,646. Total 59,251.
- Asylum-related returns YE June 2026 = 12,568 (3,841 enforced, 8,727 voluntary) in Asy_00a and Ret_05 (Ret_05 also shows 195 refused at port).
- Returns of small boat arrivals YE June 2026 = 3,310 in Ret_06b; Ret_06a quarters 631 + 885 + 1,794 (Jan-Jun 2026) = 3,310.
(The release's "How many people are returned from the UK?" chapter is the publisher's narrative source; the summary-page extract did not quote returns figures, so these checks are dataset vs summary table.)

## Stories this could tell
1. **Returns are mostly voluntary.** In YE June 2026, 30,936 voluntary returns against 9,669 enforced (Ret_01); enforced returns rose 6.5% and remain well below the 2004 to 2015 level (12,000 to 21,000 a year). Use the publisher's types, with definitions in the method note.
2. **The long arc since 2004.** Enforced returns fell from 21,425 (2004) to 2,788 (2021) and have risen each year since (9,908 in 2025, provisional). A clean single line with both directions written.
3. **Returns of small boat arrivals.** From 9 in 2018 to 3,310 in YE June 2026 (Ret_06a/b), the most common nationality Albanian (1,321 of 3,310). Compare with arrivals only with care: return date and arrival date differ (note 35), so no "share of arrivals returned" figure.
4. **Who is returned is not who arrives by boat.** The most common nationalities returned overall in YE June 2026 were Indian (11,383), Brazilian (7,478) and Romanian (6,351) (D01), mostly voluntary or refused at port; show as published, by return type.

## Traps
- **Provisional:** the latest 7 quarters are revised, and "other verified returns" are revised upwards as data matching catches up (note 28): recent voluntary totals will rise. Say so in the method note.
- Series breaks: pre-2010 enforced figures exclude "other returns from detention" (note 6); detention vs non-detained split not comparable around October 2020 (note 7); asylum-related returns not comparable before/after October 2020 (note 31).
- Case variants in D01 (`Home country`/`Home Country`, `Non-detained Enforced removals`/`Non-detained enforced removals`): normalise before grouping.
- Ret_03 and Ret_06a layouts (side-by-side tables; interleaved total rows) break naive readers; the detailed dataset is safer.
- Returns are events, not people: the same person can be returned more than once (Ret_06 counts only the earliest return after a small boat arrival, note 37).
- Foreign national offender tables: avoid, or show only the total with the definition. No nationality ranking of offenders.
- Neutral wording: "returns", "enforced returns", "voluntary returns" (the publisher's terms); not "deportations" (a legal term for a subset), never "removing illegals".
