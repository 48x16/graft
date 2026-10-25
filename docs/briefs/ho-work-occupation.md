# Home Office: Sponsored work entry clearance visas by occupation and industry (SOC 2020), year ending June 2026
- Page: https://www.gov.uk/government/statistical-data-sets/immigration-system-statistics-data-tables   Licence: OGL v3.0 (Crown copyright, stated on the page)   Updates: quarterly. Published 27 August 2026, next update 26 November 2026.
- Coverage: UK sponsored work entry clearance visas, main applicants only (no dependants). Quarterly from 2021 Q1 to 2026 Q2.
- Files (in .cache/ho-work-occupation/): `occupation-soc2020-visas-datasets-jun-2026.xlsx`, 7.6 MB. It holds Occ_D01 (applications) and Occ_D02 (grants), each as a pivot sheet plus a long `Data_` sheet. Source: https://assets.publishing.service.gov.uk/media/6a85c4761b45e4e555421edd/occupation-soc2020-visas-datasets-jun-2026.xlsx. The hash and the file name change each edition. The older SOC 2010 file (to March 2024) is superseded: ignore it.
- Status: not accredited ("Accredited Official Statistics: No" on the Contents sheet). Data from 2021 Q1 to 2024 Q3 is modelled. Data from 2026 Q1 onwards is provisional. Say all of this in the method note.

## Tables

**Data_Occ_D02 (grants): the one to build from.** One row is quarter × nationality × visa subgroup × industry × SOC unit group. 63,585 data rows. Rows 0 to 2 are the title and links, row 3 is the header, and data starts at row 4.
- Columns: `Year`, `Quarter`, `Nationality` (189 values), `Region`, `Visa type` (Worker, Temporary Worker), `Visa type subgroup` (19 values, including "Skilled Worker", "Health and Care Worker", "Seasonal Worker (previously Tier 5)", and the Global Business Mobility routes), `Industry` (22 labels, self-assigned by the sponsor), `Occ. major group` (9 values, "2 - Professional Occupations"), `Occ. sub-major group`, `Occ. minor group` ("613 - Caring Personal Services"), `Occ. unit group` (334 values, "6135 - Care workers and home carers"), `Grants`.
- Marker `*` means not available. From 2021 Q1 to 2024 Q3, `Nationality`, `Region` and `Occ. unit group` are all `*`, because the modelled SOC 2010 to 2020 conversion is not reliable at that level. A full time series is only possible at minor group (3-digit) and above, or by industry. Unit-group and nationality detail starts in 2024 Q4.
- Counts are integers (the modelled values are already rounded). 52,178 rows are under 5. Aggregate before showing anything, and avoid nationality × occupation cells.

**Data_Occ_D01 (applications):** same columns, with `Applications`. 69,861 rows.

## Headline figures (checked)
- Caring Personal Services (minor group 613) Health and Care Worker grants: 107,772 in 2023, and 344 in the year ending June 2026. These match the work chapter ("fell by over 99% (107,772 to 344)").
- Medical practitioners (221) were 4,189 of the 7,143 Health and Care Worker grants in the year ending June 2026, which is 59%. This matches the published 59%.
- The dataset gives 7,143 Health and Care Worker grants for the year ending June 2026, against 7,228 in Vis_D02, and 26,798 Skilled Worker grants against 26,894. The small gaps are expected: these are records matched to a Certificate of Sponsorship (note 7), extracted at a different time (note 13). Use ho-visas for route totals and this dataset for shares and mix.

## Stories this could tell
- **The care worker years.** Grants to people in caring personal services (613) went from 3,721 in 2021 to 37,394 in 2022 and 108,099 in 2023, then 9,648 in 2024 and 3,179 in 2025. This is the single biggest swing in the work visa system. Policy context goes in the method note as dated facts: care workers could no longer bring dependants from March 2024, and overseas recruitment for SOC 6135 and 6136 closed on 22 July 2025.
- **Who the Health and Care route serves now.** In the year ending June 2026, doctors (221 Medical Practitioners, 4,189) were the largest group, ahead of nurses (1,125) and caring personal services (344). In 2023 it was care 107,772, nurses 22,858, doctors 8,911.
- **The jobs behind Skilled Worker visas today.** The top unit groups across Skilled Worker and Health and Care, year ending June 2026: generalist doctors (3,126), programmers (2,550), finance and investment analysts (2,518), management consultants (1,734). A ranked bar of the top 15 works. Generate the list rather than hard-coding it.
- **Which industries sponsor.** Health and social work (7,167) leads, ahead of finance (5,934), professional and scientific (5,338) and information and communications (3,659), year ending June 2026. Industry is self-assigned, so caveat it (note 9).
- **Seasonal workers are the biggest sponsored route now.** Seasonal Worker accounts for 41,735 of the 106,685 sponsored main-applicant grants in the year ending June 2026, more than Skilled Worker and Health and Care combined (about 34,000). That surprises most readers.

## Traps
- **Main applicants only:** no dependants. Never add this to Vis_D02 totals.
- **Modelled period:** 2021 Q1 to 2024 Q3 is modelled. There is a break in detail at 2024 Q4, when unit group and nationality appear. Show the long series at minor group or industry level. If a chart crosses 2024 Q3/Q4, put a method-note line on the modelled estimates.
- **Not accredited, and partial coverage:** only grants matched to a CoS are included (note 7), so totals are slightly lower than in ho-visas.
- **Industry labels:** there is a stray duplicate, "Administrative and Support Activities" (3 grants, 2021/2023), alongside "Administrative and Support Service Activities" (63,416). Merge them. Some labels contain semicolons, so quote them when writing CSV.
- **Hierarchy codes in labels** ("613 - Caring Personal Services"): split on the first " - " for code and name.
- **Small cells:** most rows are under 5. Don't publish nationality × occupation × quarter detail. Aggregate to year and to top-N.
- **Note 11:** Government Authorised Exchange data for Q4 2024 to Q4 2025 was refreshed in this edition, so those quarters differ from earlier editions.
- **Wording:** "visas granted to care workers", not "foreign care workers". No nationality rankings with adjectives.
