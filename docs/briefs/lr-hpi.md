# HM Land Registry: UK House Price Index (UK HPI), average price
- Page: https://www.gov.uk/government/collections/uk-house-price-index-reports → the monthly "UK House Price Index: data downloads <month> <year>" page (slug changes every month, e.g. `uk-house-price-index-data-downloads-august-2026--2`) → link "Average price" (CSV).
  File: `https://publicdata.landregistry.gov.uk/market-trend-data/house-price-index-data/Average-prices-2026-08.csv` (GOV.UK adds `utm_` query strings: strip them). Not "Average price by property type" or "Average price seasonally adjusted".
  Licence: OGL v3.0 ("About the UK HPI", section 7 Republishing data: "UK HPI data is published under Open Government Licence"). Required attribution: "Contains HM Land Registry data © Crown copyright and database right 2020. This data is licensed under the Open Government Licence v3.0."
  Updates: monthly, about two months in arrears (August 2026 data released in October 2026).
- Producers: HM Land Registry with ONS, Registers of Scotland and Land & Property Services Northern Ireland. Official statistics.
- Coverage: UK, countries, English regions, counties, and all local authority districts, monthly. Countries from April 1968; districts from January 1995. Latest month August 2026 (provisional: recent months are revised as more sales are registered).
- Files (in .cache/lr-hpi/): `Average-prices-2026-08.csv`, 7.6 MB, 152,325 data rows (the full history, despite GOV.UK labelling it 7.4 KB).

## Table
One CSV, long format, one row per month x area: `Date, Region_Name, Area_Code, Average_Price, Monthly_Change, Annual_Change, Average_Price_SA`.
- `Date` is ISO, first of the month (`2026-08-01`). `Average_Price` is £, not seasonally adjusted, mix-adjusted (hedonic) average, integers. `Monthly_Change` / `Annual_Change` are percentages (blank in early years). `Average_Price_SA` is filled only for countries and regions.
- August 2026 has 405 rows: K02/K03/K04 (UK, GB, E&W), 4 countries, 9 English regions (E12), 6 metropolitan counties (E11), 21 counties (E10), 2 E13 (Inner/Outer London), and districts: E06 62, E07 164, E08 36, E09 33, W06 22, S12 32, N09 11.
- Region names differ from ONS names in places ("City of Glasgow", "City of Westminster"): join on code, never name.
- **Northern Ireland is quarterly.** The NI and N09 figures are the latest quarter's (Q2 2026), repeated in each month of the quarter (July and August 2026 are identical). The release says "in the year to Q2 (Apr to Jun) 2026".
- Scotland's figures come from Registers of Scotland, NI's from LPS; methods are aligned (hedonic, mix-adjusted) across the UK.

## LAD code match (against ONS mid-2025 MYE4 / GDHI Table 3, 361 districts)
- **358 match exactly; 2 match after re-coding; 1 has no figure: 360 of 361 (99.7%).**
- Re-coded, as for the Home Office data: `E08000038` Barnsley → `E08000016`, `E08000039` Sheffield → `E08000019` (the UK HPI uses the April 2025 codes for the whole back series).
- **Isles of Scilly (`E06000053`) is not in the file at all** (too few sales). Set it to null, never 0.
- All 346 local authorities in the Home Office asylum support file (D11, 30 June 2026) have a house price after the re-code.

## Headline figures (checked)
- UK average price August 2026 = **£273,037** (`K02000001`). Release "UK House Price Index for August 2026": "The average UK house price was £273,000 in August 2026 (provisional estimate)" ✓
- England £293,525: release "increased in England to £294,000 (0.4%)" ✓ (Annual_Change 0.4). Northern Ireland £202,487 (Q2 2026), release table "Northern Ireland (Quarter 2 - 2026) £202,487" ✓
- Lowest district: Inverclyde £114,526; highest: Kensington and Chelsea £1,204,072.

## Stories this could tell
1. **Housing costs and where asylum accommodation is.** Cut districts into fifths by average house price: people on asylum support per 10,000 residents, cheapest fifth 21.2, then 17.4, 10.0, 8.9, 9.1 (August 2026 prices, support at 30 June 2026, exact counts). Rank correlation with rate −0.29 (districts of 25,000+ with a rate), weaker than with disposable income per head (−0.43), because London's high prices sit with sizeable numbers in some boroughs. Context: the Home Affairs Committee (HC 580, October 2025, paras 132 and 148) found that the cost of housing drives where accommodation is procured.
2. Several of the highest-rate districts are among the cheapest for housing (Burnley £136,703, Hyndburn £142,964).

## Traps
- An average price (mix-adjusted), not the price of a typical rental or the cost of the Home Office's contracts. Say "average house price", name the month, and say it's the sale price of homes, not rents.
- Monthly and noisy in small districts (Orkney −7.8% in July 2026 alone); a single month is fine for ranking into fifths, but don't print month-on-month changes for small areas.
- NI is a quarter, not a month: say so in the method note if NI is shown.
- Latest months are provisional and revised; don't compare figures across editions.
- Income (2024), population (mid-2025), support (30 June 2026) and house prices (August 2026) are four different dates.
