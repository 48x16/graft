# ONS: Regional gross disposable household income (GDHI): local authorities, 1997 to 2024
- Page: https://www.ons.gov.uk/economy/regionalaccounts/grossdisposablehouseholdincome/datasets/regionalgrossdisposablehouseholdincomelocalauthorities
  File: `…/1997to2024/regionalgrossdisposablehouseholdincomelocalauthorities2024.xlsx`. Each edition is a new folder (`1997to2023/…2023.xlsx`), with no `current/` link: scrape the page for the first `.xlsx`.
  Licence: OGL v3.0   Updates: annual. Released 19 August 2026; next release: to be announced (usually late summer/autumn).
- Coverage: UK, all 361 local authority districts (England 296, Wales 22, Scotland 32, NI 11), calendar years 1997 to 2024, annual. 2024 is provisional.
- Files (in .cache/ons-gdhi/): `regionalgrossdisposablehouseholdincomelocalauthorities2024.xlsx` — 11 tables, 6.2 MB
- Status: **official statistics in development** (the 2026 bulletin: "Regional GDHI statistics remain official statistics in development while we continue to strengthen the evidence base supporting their quality"). Say so in the method note.
- Avoid the older dataset "Regional GDHI: local authorities by ITL1 region" (`…localauthoritiesbyitl1region`): its newest files are the 2022 edition, split into 12 workbooks.

## Why not a deprivation index
The four nations each publish their own index: the English Indices of Deprivation (IMD), the Welsh Index of Multiple Deprivation (WIMD), the Scottish Index of Multiple Deprivation (SIMD) and the Northern Ireland Multiple Deprivation Measure (NIMDM). They **can't be combined into one UK ranking**:
- each ranks small areas only within its own nation (LSOAs, data zones, super output areas, all different sizes), so "most deprived 10%" means a different thing in each;
- the domains, indicators and weights differ (e.g. different benefit systems, NI's own data sources), and so do the reference years (IMD 2019/2025, WIMD 2019, SIMD 2020, NIMDM 2017);
- they measure deprivation (the bottom of the distribution), not affluence, and they're published as small-area ranks, so turning them into a district score is a further modelling choice.
Academic "UK-wide adjusted IMD" versions exist, but they aren't official statistics, and their licences and methods vary. GDHI per head is a single ONS measure, made the same way for all 361 districts, and it's OGL. That makes it the consistent choice.

## Tables
Sheets: `Cover sheet, Comments, Notes, Contents, Table 1 … Table 11`. In Tables 1 to 11, rows 0 to 2 are title, "This worksheet contains one table" and "Return to Contents"; **row 3 is the header**; data from row 4. One row is one LAD (Tables 1 to 6: 361 rows), or one LAD × transaction (Tables 7 to 11: 361 × 17 = 6,137 rows). There are **no total rows** (no UK, region or nation rows): every row is a district. Column 0 `Region` gives the ITL1 region or nation (12 values: NE 12, NW 35, Y&H 15, EM 35, WM 30, EoE 45, London 33, SE 64, SW 27, Wales 22, Scotland 32, NI 11).

- **Table 3** (the one to use): `Region, LAD code, LAD name, 1997, …, 2024`. GDHI per head, £, current prices. Integers.
- **Table 4**: same layout, GDHI per head as an index, UK = 100 (floats such as `78.400000000000006`: round to 1 dp). Handy for "x% above/below the UK average".
- **Table 1**: total GDHI, £ million. **Table 2**: the resident population ONS used (persons) [note 1].
- **Tables 5, 6**: annual % growth in total and per-head GDHI (from 1998).
- **Tables 7 to 9**: components (`Transaction code`, `Transaction`), 17 values: B.2g Operating surplus, B.3g Mixed income, D.1 Compensation of employees, D.4 Property income received/paid, D.61/D.62 social benefits received / social contributions paid, D.5 Current taxes on income and wealth, D.7 other transfers, subtotals, B.5g Balance of primary incomes, B.6g Gross Disposable Income. Transaction names in Table 9 have a leading space: trim them.
- **Tables 10, 11**: growth in components. `[x]` marks suppressed growth in the balance of secondary income [note 2]: the only marker in the file. Tables 1 to 6 have none (all 2024 cells are numeric).

## LAD code vintage vs the asylum support data
Against the 346 codes in `public/data/features/asylum-support.json` (Home Office D11, 30 June 2026):
- **344 of 346 match Table 3 exactly (99.4%)**, and all 344 names match.
- Not matching: **`E08000038` Barnsley → `E08000016`** and **`E08000039` Sheffield → `E08000019`**. The Home Office uses the April 2025 codes, issued for a minor Barnsley–Sheffield boundary adjustment; GDHI uses the April 2023 set. Re-code one-to-one.
- Cumberland (`E06000063`), Westmorland and Furness (`E06000064`), North Yorkshire (`E06000065`) and Somerset (`E06000066`) are present in both, with the full 1997–2024 back series already re-estimated on the new boundaries. No merging needed.
- The LAD code set in GDHI Table 3 is identical to ONS mid-2025 population MYE4 (361 = 361). After the re-code, every asylum area has both a population and a GDHI figure.

## Headline figures (checked)
- UK GDHI per head 2024 = sum of Table 1 (£1,798,881m) ÷ sum of Table 2 (69,281,437) = **£25,965**. Bulletin "Regional GDHI, UK: 1997 to 2024": "compared with a UK average of £25,965" ✓
- Lowest LAD 2024 = Leicester **£16,786** (Table 3). Bulletin: "Leicester had the lowest GDHI per head at £16,786" ✓
- Highest LAD 2024 = Kensington and Chelsea £115,641, then City of London £109,153 and Westminster £82,503. The bulletin's highest is the ITL3 area "Westminster and City of London" at £84,292: a different geography, so it's consistent.

## Stories this could tell
(Joined with ONS mid-2025 population and the Home Office's people on asylum support at 30 June 2026. Absent and "fewer than 10" areas counted as 0, so the low-income end, if anything, is understated.)
1. **The answer to the user's question, measured.** Split the 361 districts into fifths by GDHI per head. People on asylum support per 10,000 residents: lowest-income fifth 24.7, then 13.8, 10.1, 6.5, and 8.3 in the highest-income fifth. The rate in the least well-off fifth is about three times that of the top two. The rank correlation between income and rate is about −0.46.
2. **London bends the top fifth.** Outside London the gradient is steady: 23.5, 18.1, 9.3, 6.8, 4.7 per 10,000. Several high-income inner London boroughs house people (accommodation type is in D11, not in the current JSON: check before saying "hotels") (Kensington and Chelsea 12.4, Hammersmith and Fulham 11.8), while Richmond upon Thames (0.8), Elmbridge (1.1), Westminster (1.9) and Wandsworth (2.2) are low.
3. **Few people supported in the most affluent districts.** Of the 72 highest-income districts, 23 have fewer than 10 people or none recorded; in the lowest-income fifth, only 1 does.
4. **A scatter with the user's own area marked.** GDHI per head (x, log scale because of Kensington and Chelsea) against rate per 10,000 (y), with a table twin. It answers "is my area typical for its income?"

Sensitive, and essential to word right:
- **Correlation, not cause, and not "doing their bit".** Since 2022 every council in England, Scotland and Wales is expected to take part in asylum dispersal. But the Home Office's contractors choose and procure the accommodation, and dispersal follows housing costs: cheaper housing is where the properties are, and cheaper housing goes with lower household income. Hotels are booked by the Home Office, not councils. The data shows where people are accommodated; it doesn't show councils' willingness. Put this in the method note, and give a neutral title (e.g. "Where support is housed").
- No "burden", "share of the load", "fair share". Use "people on asylum support per 10,000 residents".

## Traps
- **Mean, not median.** GDHI per head is a total divided by population: very wealthy residents pull it up (Kensington and Chelsea is 4.5× the UK figure). Rank or quintile it rather than using raw £ in a correlation, and use a log axis on scatters.
- **Household sector, not households.** It covers all individuals in the household sector, including non-profit institutions serving households; it isn't "average household income" (cover sheet). Call it "disposable income per head".
- **Residence-based, current prices**, with 2024 provisional and every back year revised each edition. Don't compare £ across editions or adjust for inflation by hand.
- **Population mismatch.** Table 2 uses the pre-revision mid-2024 population (UK 69,281,437); the October 2026 mid-2025 workbook revised mid-2024 to 69,256,274. Use GDHI's own per-head figure (Table 3) for income, and MYE mid-2025 for the asylum rate denominator. Don't divide Table 1 by a different population.
- **Three different reference dates**: income in calendar 2024, population at mid-2025, asylum support at 30 June 2026. Name each in the method note.
- **Official statistics in development**: say so.
- City of London (pop 15,631) and Isles of Scilly (2,299) are tiny: their per-head income and rates are volatile. Show them in tables, but keep them out of prose superlatives (guard by population).
