# Home Office: Entry clearance visas, applications and outcomes (Immigration system statistics, year ending June 2026)
- Page: https://www.gov.uk/government/statistical-data-sets/immigration-system-statistics-data-tables   Licence: OGL v3.0 (Crown copyright, stated on the page)   Updates: quarterly. Published 27 August 2026. The summary cover sheet gives the next update as 26 November 2026, but the detailed workbook's Contents sheet says 27 October 2026. Re-check the collection page.
- Coverage: UK entry clearance visas (applications made outside the UK, plus Ukraine "permission letters"). Quarterly from 2005 Q1 to 2026 Q2. The summary tables give calendar years 2014 to 2025, plus the years ending June 2025 and June 2026.
- Files (in .cache/ho-visas/):
  - `visas-summary-jun-2026-tables.ods`: summary tables Vis_01 to Vis_06, 58 KB (https://assets.publishing.service.gov.uk/media/6a85c6003d82f78d5c514552/visas-summary-jun-2026-tables.ods)
  - `entry-clearance-visa-outcomes-datasets-jun-2026.xlsx`: detailed datasets Vis_D01 (applications) and Vis_D02 (outcomes) in long format, 31.5 MB (https://assets.publishing.service.gov.uk/media/6a85c3741b45e4e555421eda/entry-clearance-visa-outcomes-datasets-jun-2026.xlsx)
  - The URL hash and the file name change with every edition. The pipeline must find the links from the collection page (match the link text "Entry clearance visa applications and outcomes detailed datasets").
- Status: accredited official statistics. Data from 2026 Q1 onwards is provisional.

## Tables

**Data_Vis_D02 (detailed workbook): the one to build from.** One row is year/quarter × nationality × visa subgroup × applicant type × outcome, with 407,284 data rows. Rows 0 to 2 are the title and links, row 3 is the header, and data starts at row 4. Reading it with `xlsx.js` takes about 10 s. Use `node --max-old-space-size=8000`.
- Columns: `Year`, `Quarter` ("2026 Q2"), `Nationality` (218 values), `Region` (16 values, e.g. "Asia South", "EU 14", "EU 8", "EU 2", "EU Other"), `Visa type group` (5 values: Work, Study, Family, Visitor, Other), `Visa type` (18 values), `Visa type subgroup` (77 values, including legacy Tier 1/2/4/5 labels), `Applicant type` (Main Applicant, Dependant, All), `Case outcome` (Issued, Refused, Withdrawn, Lapsed), `Decisions`.
- Grants are rows with `Case outcome` = "Issued". The grant rate is Issued / (Issued + Refused), which excludes withdrawn and lapsed cases, as the publisher does.
- All counts are integers. There are no [c] or [x] markers. 122,623 rows hold 0 or 1.
- The key subgroups are "Skilled Worker" and "Health and Care Worker" (both from 2020 Q4), under `Visa type` "Worker". They replaced "Tier 2 - General" and "Tier 2 - Dependant", which wind down to 2021–22.

**Data_Vis_D01 (detailed workbook):** applications. Same columns, minus `Case outcome`, with the count in `Applications`. 253,482 rows. Applications are dated by biometric enrolment (note 17).

**Summary ODS (simple, enough for a first page):**
- Vis_01: grants by visa type. Columns: `Visa type`, `2014` … `2025`, `Year ending June 2025`, `Year ending June 2026`, `Change in the latest year`, `Percentage change in the latest year (%)` (a fraction: -0.18 means -18%). 21 rows. Each group row is followed by its detail rows (Work visas > Worker, Temporary Worker, Investor…, Other work), and the last row is `Total entry clearance visas`. Totals and detail are mixed.
- Vis_02: applications, decisions, grants, grant rate and refusals by visa type, latest year only.
- Vis_03a/b/c (work / Worker / Temporary Worker), Vis_04 (sponsored study), Vis_05 (family), Vis_06 (visitor): each has the top 20 nationalities plus "Other Nationalities" and "Total". `Grant rate` is a fraction, but sometimes the string ">99%". The z marker means not applicable.

## Headline figures (checked)
- Work visas granted, year ending June 2026: Vis_D02 sum 234,841 = 234,841 (Vis_01 and "Why do people come to the UK? Work"). This is down 18%.
- Work visas in 2023, the peak: 613,627 = 613,627 (Vis_01, work chapter).
- All entry clearance visas, year ending June 2026: 2,932,329 = 2,932,329 (Vis_01).
- Work visas by applicant type, year ending June 2026: 158,722 main applicants and 76,119 dependants = 158,722 and 76,119 (work chapter).
- Skilled Worker: 26,894 main + 34,226 dependants = 61,120 = 61,120, down 26% (work chapter).
- Health and Care Worker: 7,228 main + 26,915 dependants = 34,143 = 34,143. Main applicants are down 65% (work chapter).
- Every check matched.

## Stories this could tell
- **Peak and fall.** Work visas, including dependants, rose from 167,146 in 2014 to 613,627 in 2023, then fell to 234,841 in the year ending June 2026. That is still above 2019 (192,559). Generate "the fewest since …" from the data.
- **Health and Care Worker, rise and fall.** Main-applicant grants peaked at 45,071 in 2023 Q3 and were 1,325 in 2026 Q2. A quarterly line shows it plainly.
- **Dependants now make up most visas.** 79% of Health and Care Worker visas in the year ending June 2026 went to dependants (26,915 against 7,228 main applicants), and 56% of Skilled Worker visas. Wording: "most Health and Care Worker visas now go to family members joining or accompanying a worker". Many are joining workers who arrived in earlier years (see Traps).
- **What visas are for.** Visitor visas are 2,185,158 of the 2,932,329 granted (75%). Study (385,974) outnumbers work (234,841). This corrects the idea that visas mean work.
- **Grant rates by route.** Work 90%, study 95%, family 86%, visitor 80% (Vis_02). Show nationality rates as published (top nationalities by number), with no adjectives and no "lowest" ranking.
- **Who holds work visas.** India is the largest work nationality (47,009 grants). The Temporary Worker list is led by Kyrgyzstan, Uzbekistan, Tajikistan and Kazakhstan, almost all on the Seasonal Worker route. That surprises most readers. It is confirmed in ho-work-occupation, where Seasonal Worker accounts for 41,735 grants.

## Traps
- **Provisional data.** 2026 Q1 and Q2 are provisional and are revised in the next edition. Earlier quarters also shift slightly, because the source is a live database.
- **Applicant type "All".** It is used for Family, Other and Visitor rows in older years, where there is no main/dependant split. Don't compute a dependant share there. Work and Study are fully split.
- **Years.** The summary uses calendar years plus "year ending June". The dataset is quarterly. Year ending June Y = Q3 and Q4 of Y-1 plus Q1 and Q2 of Y. Label periods in the publisher's words.
- **Dependants are not "per worker".** A dependant may be joining a worker granted a visa in an earlier year (note 8: dependants are assigned to the main applicant's subgroup). Never divide dependants by main applicants and call it a family size.
- **Visas are not arrivals or people.** Some visas go unused. Entry clearance covers applications made outside the UK only. In-UK switches and extensions are in the separate Extensions tables (the work chapter cites 336,215 Health and Care extensions, up 19%). Mention them in a method note so the fall isn't read as "fewer care workers in the UK".
- **Series breaks.** The PBS relabelling of 2019/2020 (notes 14 and 15). Skilled Worker and Health and Care Worker start in December 2020. Chart those two from 2021, or say so if you join them to Tier 2.
- **Totals mixed with detail.** Vis_01 group rows sit above their detail rows. Vis_03 to Vis_06 end with "Other Nationalities" and "Total".
- **Nationality groupings.** "Hong Kong" includes some BN(O)s (note 13). Regions use EU14/EU8/EU2/EU Other.
- **Wording.** "Visas granted", "workers", "dependants", not "migrants". Policy dates (the care worker dependant rule from March 2024, the end of overseas care worker recruitment from 22 July 2025) belong in method notes as dated facts. Don't score them.
