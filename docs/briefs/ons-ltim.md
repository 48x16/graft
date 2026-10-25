# ONS: Long-term international immigration, emigration and net migration flows, provisional
- Page: https://www.ons.gov.uk/peoplepopulationandcommunity/populationandmigration/internationalmigration/datasets/longterminternationalimmigrationemigrationandnetmigrationflowsprovisional   Licence: OGL v3.0 (cover sheet: "© Crown copyright 2026 … Open Government Licence"; credit "Source: Office for National Statistics licensed under the Open Government Licence")   Updates: twice a year (May: YE December; November: YE June). Next release "to be announced", most likely November 2026 (YE June 2026). Each edition revises the previous four quarters.
- Bulletin: https://www.ons.gov.uk/peoplepopulationandcommunity/populationandmigration/internationalmigration/bulletins/longterminternationalmigrationprovisional/yearendingdecember2025
- Coverage: UK, YE June 2012 to YE December 2025, rolling year ending each quarter (Mar, Jun, Sep, Dec). Reason breakdowns start later (non-EU+ from YE June 2019, EU+ visa holders from YE June 2021).
- Files (in .cache/ons-ltim/):
  - `ltim-may2026.xlsx` — current edition (published 21 May 2026, YE Dec 2025), 164 KB. Source URL: `https://www.ons.gov.uk/file?uri=/peoplepopulationandcommunity/populationandmigration/internationalmigration/datasets/longterminternationalimmigrationemigrationandnetmigrationflowsprovisional/yearendingdecember2025/may2026publicationspreadsheet.xlsx`
  - `ltim-nov2025.xlsx` — previous edition (YE Jun 2025), 2.3 MB, same table layout. Superseded: reference only, do not build from it.
  - File names change every edition (`ltimnov25.xlsx`, `may2026publicationspreadsheet.xlsx`): the pipeline must take the URL from config, not guess it.
- Status: **official statistics in development** (all tables). YE Mar 2025 to YE Dec 2025 are **provisional**; YE Sep 2024 to YE Jun 2025 were **revised** in this edition. Say both in method notes.

## Tables
All read fine with `pipeline/lib/xlsx.js`. Each data sheet: title rows 0–4, header on row 5 (row 4 in tables 5, 6a, 6b; row 6 in table 9), data below, no totals rows mixed in, no trailing footnotes. Header cells contain `\r\n` and note markers (`"British\r\n[definition 2]"`): normalise by taking the text before `\r\n`. **No suppression markers** (`[c]`, `[x]`, `:`) anywhere; small values are shown as `0` (rounded to the nearest thousand, so 0 means under 500). Only non-numeric data cell: `Not published` in table 5. All values are people, rounded to the nearest 1,000 independently (components need not sum to totals; net need not equal imm − emi exactly).

Period labels: `YE Jun 12` … `YE Dec 25 P`. Suffixes: ` R` revised, ` P` provisional, ` P R` both. Strip with `/^YE (\w{3}) (\d\d)/` and keep the flags.

- **Table 1** (sheet `1`) — immigration, emigration, net by nationality. One row = flow × period. Columns: `Flow`, `Period`, `All Nationalities`, `British`, `EU+`, `Non-EU+`. 3 flows × 55 quarters (YE Jun 12 to YE Dec 25 P) = 165 rows. Series breaks: British pre-June 2021 not comparable with later (note 16); all comparisons across June 2021 "with caution" (note 17). EU+ before YE Mar 2021 means EU members at the time; from YE Jun 2021 EU+ = EU27 + Norway, Iceland, Liechtenstein, Switzerland.
- **Table 2** (sheet `2`) — 95% uncertainty intervals. Columns `Flow`, `Period`, `Estimate`, `Lower bound`, `Upper bound`. All nationalities only, half-yearly YE Jun 22 to YE Dec 25 (8 periods × 3 flows). Intervals are asymmetric.
- **Table 3a/3b** — top 10 EU+ visa-holder nationalities, immigration / emigration by reason. Columns `Nationality`, `Flow`, `Period`, `All reasons`, `Work - related`, `Study - related`, `Other`. YE Dec 21 to YE Dec 25 P (5 years) × 10 = 50 rows. Mostly 0–6,000: too small to say much.
- **Table 3c/3d** — top 10 EU settled-status nationalities, immigration / emigration, `Estimate` only. 50 rows each.
- **Table 3e/3f** — top 10 non-EU+ nationalities, immigration / emigration by reason (`All reasons`, `Work - related`, `Study - related`, `Other`). 50 rows each. The top-ten list is chosen as of YE Dec 2025, so it changes between editions (note 4); excludes asylum and resettlement arrivals except BN(O) and Ukraine schemes (note 9). Emigration reason is the *original* reason for arriving.
- **Table 4a** — EU+ visa holders by reason. Columns `Flow`, `Period`, `All reasons`, `All Work Related`, `Work: Main applicant`, `Work: Dependant`, `All Study Related`, `Study: Main applicant`, `Study: Dependant`, `Family`, `Other`, `Asylum`. YE Jun 21 to YE Dec 25 P (19 quarters) × 3 flows. Small (net about 20,000).
- **Table 4b** — **non-EU+ by reason: the core table for "why people come"**. Columns `Flow`, `Period`, `All reasons`, `All Work Related`, `Work: Main applicant`, `Work: Dependant`, `All Study Related`, `Study: Main applicant`, `Study: Dependant`, `Family`, `All Humanitarian`, `Humanitarian: BNO`, `Humanitarian: Resettlement`, `Humanitarian: Ukraine`, `Asylum`, `Other`. YE Jun 19 to YE Dec 25 P (27 quarters) × 3 flows = 81 rows. "All …" columns are subtotals of the next columns: don't add both. Reason = initial reason on arrival, not later visa switches (note 8). Asylum = people who claimed asylum within a year of arrival, by any route (definition 11).
- **Table 5** — revisions history for YE Sep 24 to YE Jun 25. One row = period × publication × estimate stage (`Initial provisional estimate (no travel data)`, `Revised provisional estimate (6 months travel data)`, `Completed estimate (12 months travel data)`, plus `Revision for …` difference rows: filter these out or use them, don't mix). Imm/emi/net × All/British/EU+/Non-EU+ (12 value columns).
- **Table 6a/6b** — comparison with Home Office visas granted and DWP NINo allocations. Not migration measures: context only.
- **Table 7a–7d** — imm/emi/net by age group (8: All ages, Under 16, 16–24, 25–34, 35–44, 45–54, 55–64, 65+) × sex (All, Male, Female) for British, EU+ visa holders, EU settled status, non-EU+. Half-yearly YE Dec 22 to YE Dec 25 P (7 periods × 3 flows). Header text is `"All\r\nUnder 16"` etc: split on `\r\n` into sex and age.
- **Table 8** — EU+ by category: `All EU+`, `EU Settled Status`, `EU+ Visa Holder`, `Irish Nationals`. YE Jun 21 to YE Dec 25 P, 3 flows.
- **Table 9** — non-UK-born population (a stock, not a flow): `Date`, `Country`, `EU+ born population`, `Non-EU+ born population`, `Total non-UK born population`. Census 2021 (E, W, NI), Census 2022 (Scotland), then UK at 30 June 2022, 2023, 2024 (2022–2024 provisional, note 22). Only 3 comparable UK points.

## Headline figures (checked)
All match the bulletin for YE December 2025 (ONS, 21 May 2026):
- Net migration YE Dec 2025 = 171,000 (bulletin 171,000); British −136,000, EU+ −42,000, non-EU+ 350,000 (all match).
- Immigration 813,000; emigration 642,000 (bulletin 813,000 / 642,000).
- Revised YE Dec 2024 net = 331,000 (bulletin "updated" 331,000; first published May 2025 as 431,000, table 5).
- Non-EU+ immigration by reason YE Dec 2025: study 294,000, work 146,000, asylum 88,000 (bulletin: study 47% / 294,000, work 23% / about 146,000, asylum 14% / 88,000).
- Net migration 95% interval YE Dec 2025: 145,000 to 197,000 (bulletin matches).

## Stories this could tell
1. **From the peak to a fifth of it.** Net migration was 924,000 in YE Jun 2023 (the series high) and 171,000 in YE Dec 2025; immigration fell from 1,466,000 to 813,000 while emigration rose from 543,000 to 642,000, so both sides moved. Generate "highest/lowest since" only within the post-June-2021 method, or flag the break.
2. **More British people leave than arrive, every year.** British net migration is negative in every period and reached −136,000 in YE Dec 2025 (110,000 arrived, 246,000 left), and EU+ net has been negative since YE Jun 2022 (−42,000). So the net total now comes from non-EU+ nationals alone (+350,000). British method changed in June 2021: compare only from then on.
3. **Work has fallen furthest.** Non-EU+ work-related immigration went from 471,000 (YE Dec 2023) to 146,000 (YE Dec 2025); work dependants fell from 240,000 to 74,000. Study dependants fell from 133,000 to 17,000, and their net figure is now negative (−6,000). Study is now the largest reason (294,000, 47%). Describe the measured change only. No "because of the visa rules" without a source.
4. **Asylum is now as big as work in net terms.** Non-EU+ net migration for asylum (83,000) equalled net work-related (83,000) in YE Dec 2025, against 73,000 vs 430,000 two years earlier. Sensitive: use "people who claimed asylum within a year of arriving", never water or crisis words. Show it as a share of non-EU+ net, with its base.
5. **Students who leave.** Non-EU+ emigration by original reason is mostly former students (159,000 of 278,000 in YE Dec 2025). Indian emigration rose from 41,000 to 75,000 between YE Dec 2023 and YE Dec 2025 (table 3f). Show nationalities as published (top ten by number, no adjectives).
6. **First guesses move.** Table 5: YE Dec 2024 net was first published at 431,000 and is now 331,000, mostly because British emigration was re-estimated (77,000 to 257,000). A small "how the estimate changed" chart is honest and unusual.

## Traps
- **Revisions every edition.** The last four quarters are provisional and get revised; re-read the whole series each time and never store old values. Previous editions differ for all periods because of the November 2025 British method change (note 21).
- **Series breaks at June 2021** (British method; EU+ definition; admin data replaces IPS). Avoid "highest since 2012"-style claims that cross it, or say "on current methods".
- **Rolling years.** Quarterly rows overlap: never sum quarters. For a yearly chart use YE Jun / YE Dec only, and label them "year ending June 2025", not "2025".
- **Flows vs stocks.** Table 9 (population) must not be compared with flows (note 23).
- **Subtotal columns** in 4a/4b (`All Work Related` = main + dependant; `All Humanitarian` = BNO + Resettlement + Ukraine). Pick one level.
- **Reason = reason on arrival**; emigration "reason" = original arrival reason. "Other" means different things in 3x vs 4x tables (definitions 12, 13).
- **Rounded to the nearest 1,000, independently**: totals won't add; 0 means under 500. Check sentences with small groups (EU+ visa holders, Irish nationals) and guard them (e.g. skip a reason under a few thousand).
- **Nationality groups**: "EU+" is not the EU; Irish nationals are inside EU+ (table 8). British = has a NINo and isn't on the Migrant Worker Scan (definition 2).
- **Top-ten lists change** each edition (selected on the latest year), so a nationality can appear or vanish between editions.
- **Uncertainty**: intervals cover only some sources of error; provisional figures near zero "treat with caution" (cover sheet).
- **Tables 6a/6b** (visas, NINos) are other publishers' counts of different things: don't present them as migration.

## Rejected: population of the UK by country of birth and nationality
ONS stopped the APS-based "Population of the UK by country of birth and nationality" series in 2022, citing quality problems with the weighting of the non-UK-born population. As of October 2026 there is no current admin-based replacement edition: ONS says it is still researching methods (FOI responses, 2025 to 2026). The only current figures are LTIM Table 9 above (EU+ / non-EU+ born, UK, June 2022 to 2024, provisional), so no separate `ons-born` source. Census 2021 country-of-birth tables (England and Wales; Nomis, OGL) could cover a per-area page later, but they are a 2021 snapshot.
