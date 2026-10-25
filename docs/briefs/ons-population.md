# ONS: Population estimates for the UK, England, Wales, Scotland and Northern Ireland, mid-2025
- Page: https://www.ons.gov.uk/peoplepopulationandcommunity/populationandmigration/populationestimates/datasets/populationestimatesforukenglandandwalesscotlandandnorthernireland
  File: `…/mid2025/mye25tablesuk.xlsx`. Each edition is a new folder (`mid2024/mye24tablesuk.xlsx`, …), with no `current/` link: scrape the page for the first `mye\d\dtablesuk.xlsx`.
  Licence: OGL v3.0   Updates: annual. Published 1 October 2026 (release date on page); "the next publication is scheduled for summer 2027" (cover sheet). Next release on page: to be announced.
- Coverage: UK, all 361 local authority districts (England 296, Wales 22, Scotland 32, Northern Ireland 11), mid-2011 to mid-2025 (MYE4), annual, at 30 June.
- Files (in .cache/ons-population/): `mye25tablesuk.xlsx` — summary workbook, 1.0 MB
- Status: accredited official statistics (Notes, note 14). Built from three publishers' estimates: England and Wales (ONS, 29 July 2026), Scotland (NRS, 14 July 2026), Northern Ireland (NISRA, 24 September 2026), with different methods (cover sheet).

## Tables
Sheets: `Cover sheet, Contents, Notes, Geography guide, Related publications, MYE1, MYE2 - Persons, MYE2 - Females, MYE2 - Males, MYE3, MYE4, MYE5, MYE6, MYE0`. In MYE2 to MYE6, rows 0 to 6 are title and feedback links; **row 7 is the header**; data from row 8 to row 411 (404 rows). Find the header by `r[0] === 'Code'` rather than a fixed index.

Every MYE2-6 table has the same three leading columns: `Code`, `Name`, `Geography`. `Geography` takes 10 values: `Country` (7: UK, GB, E&W, E, W, S, NI), `Region` (9), `Metropolitan County` (6), `County` (21), and the district level: `Unitary Authority` (85), `Metropolitan District` (36), `Non-metropolitan District` (164), `London Borough` (33), `Council Area` (32), `Local Government District` (11) = **361 districts**. Filter on those six Geography values to get LADs without double counting counties and regions.

- **MYE4** (the one to use): `Code, Name, Geography, Mid-2025, Mid-2024, … Mid-2011`. Persons, all ages. Newest year first. Plain integers, no markers.
- **MYE2 - Persons / Females / Males**: `Code, Name, Geography, All ages, 0, 1, … 90+`: single year of age, mid-2025 only. Useful for an adult (18+) denominator if wanted.
- **MYE3**: components of change mid-2024 to mid-2025: `Estimated Population mid-2024, Births, Deaths, Births minus Deaths, Internal Migration Inflow, Internal Migration Outflow, Internal Migration Net, International Migration Inflow, International Migration Outflow, International Migration Net, Other, Estimated Population mid-2025`. UK/GB rows say `No data` for internal in/outflow (text in a numeric column).
- **MYE5**: `Area (sq km)` then pairs of `Estimated Population mid-YYYY`, `YYYY people per sq. km`. Density is rounded to integers.
- **MYE6**: median age by LAD, mid-2011 to mid-2025 (floats like `40.700000000000003`: round to 1 dp).
- **MYE0**: England and Wales only, 95% research-based confidence intervals (318 LADs on June 2024 boundaries).
- No suppression markers anywhere in MYE2-6. Scotland's estimates are rounded to the nearest 10 (note 7).

## LAD code vintage vs the asylum support data
`public/data/features/asylum-support.json` (Home Office D11, at 30 June 2026) has 346 areas (E 289, W 21, S 28, N 8).
- **344 of 346 match MYE4 exactly (99.4%)**. Names also match on all 344 (letters-only comparison).
- The 2 that don't: **`E08000038` Barnsley → `E08000016`** and **`E08000039` Sheffield → `E08000019`**. The Home Office uses the April 2025 codes, issued for a minor Barnsley–Sheffield boundary adjustment; ONS uses April 2023/2024 boundaries (Notes, notes 10, 11 and 18). The map is one-to-one and the boundary change is tiny, so just re-code: `{ E08000038: 'E08000016', E08000039: 'E08000019' }`.
- The 2023 reorganisations are **already consistent** on both sides: Cumberland `E06000063`, Westmorland and Furness `E06000064`, North Yorkshire `E06000065`, Somerset `E06000066` all appear in both. No merging or splitting needed.
- 15 LADs are in MYE4 but **absent** from the asylum file (after the re-code): Derbyshire Dales, Isle of Wight, Lewes, Hart, Isles of Scilly, Mid Devon, Cotswold, Ceredigion, Highland, Na h-Eileanan Siar, Orkney Islands, Shetland Islands, Mid and East Antrim, Mid Ulster, Ards and North Down. Treat absent as "no people on asylum support recorded", not as missing data, but say so in the method note. A further 44 areas show `n: null, band: "fewer than 10"`.

## Headline figures (checked)
- UK population mid-2025 = 69,483,939 (MYE1 and MYE4). Bulletin "Population estimates for the UK…: mid-2025": "reaching an estimated 69.5 million people" ✓
- Countries mid-2025: England 58,834,812, Wales 3,175,181, Scotland 5,545,500, Northern Ireland 1,928,446 (MYE1); these sum to the UK figure ✓
- UK mid-2024 (revised) = 69,256,274; Notes note 12: "For mid-2024 the UK population was revised to 69,256,300" ✓

## Stories this could tell
1. **People on asylum support per 10,000 residents, by area.** The denominator for a fair comparison: UK-wide it is about 13 per 10,000 (93,150 people in the 346 areas, using the rounded per-area counts, over 69.5 million). Without it, big cities always top the list.
2. **Where asylum support is concentrated relative to population.** Glasgow City has about 60 per 10,000, the most of any area; then Hyndburn (49), Braintree (48), Coventry and Burnley (47). Several are small districts, not just big cities.
3. **By nation and region.** Per 10,000 residents: North East 25.5, North West 24.4, West Midlands 18.9, down to South East 6.8 and South West 5.7 (Scotland 12.3, Wales 10.1, NI 11.7). A ranked bar of 12 regions and nations.
4. **Population growth context.** MYE3 gives net international migration by LAD for the year to mid-2025 (UK 222,861): a separate, larger measure. Don't mix it with asylum support.

Sensitive: frame as "people on asylum support per 10,000 residents", never "burden" or "share of the load". The measure describes where accommodation is, which the Home Office and its contractors arrange; it isn't a council's choice alone.

## Traps
- **Revisions.** Mid-2022 to mid-2024 were revised in October 2026 (new international migration methods for E&W and Scotland; NI not revised). Use one edition throughout; don't mix mid-2024 from an older workbook.
- **Different methods by nation** (cover sheet): the four nations' estimates are "broadly comparable" but not identical.
- **Counties and regions are in the same table** as districts: filter on `Geography` or you'll double count.
- **Period mismatch.** Population is at 30 June 2025; asylum support is at 30 June 2026. One year apart. Say so.
- People in asylum accommodation are part of the resident population estimate, so the denominator includes them. At this scale the effect is negligible.
- Small districts (Isles of Scilly about 2,000, City of London about 15,000) give unstable rates: a handful of people makes a large rate. Guard per-area prose with a minimum population, or show "fewer than 10" bands as such and give no rate.
- The asylum per-area counts in the JSON are already rounded and banded, so a rate built from them is approximate.
- Floats such as `40.700000000000003` in MYE6: round on read.
