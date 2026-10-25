# ONS: Pay. ASHE Table 3 (region by occupation) and Earnings and employment from PAYE RTI
This brief covers two complementary sources: ASHE, which is annual, detailed and survey-based, and RTI, which is monthly, timely and drawn from HMRC's PAYE system.

## A. ASHE Table 3: region by occupation (2-digit SOC 2020)
- Page: https://www.ons.gov.uk/employmentandlabourmarket/peopleinwork/earningsandworkinghours/datasets/regionbyoccupation2digitsocashetable3
  File: `…/regionbyoccupation2digitsocashetable3/2026provisional/ashetable32026provisional.zip`. There's no `current/` link: each edition is a new folder (`<yyyy>provisional`, `<yyyy>revised`), so scrape the page for the first `.zip`.
  Licence: OGL v3.0   Updates: annual. Provisional figures come out in October (2026's was published 29 Sep to 14 Oct 2026); revised figures follow a year later. The next release is "to be announced".
- Coverage: UK employee jobs, April 2026 (the pay period that includes a date in April). The annual pay table covers the tax year to 5 April 2026. One year per zip: for a time series, download earlier editions (the `<yyyy>revised` ones).
- Files (in .cache/ons-pay/): `ashetable32026provisional.zip` (7.6 MB, 22 xlsx files). I extracted three into `ashe3/`: `…Table 3.1a Weekly pay - Gross 2026.xlsx` (432 KB), `…3.5a Hourly Pay - Gross…` (418 KB), `…3.7a Annual pay - Gross…` (461 KB). Each `…b … CV.xlsx` partner holds the coefficients of variation.
- Status: accredited official statistics (provisional for 2026).

### Tables
Each `a` workbook has the sheets `Notes`, `All`, `Male`, `Female`, `Full-Time`, `Part-Time`, `Male Full-Time`, `Male Part-Time`, `Female Full-Time`, `Female Part-Time`.
- Row 0 is the title (`Table 3 .1a Weekly pay - Gross (£) - For all employee jobsa: United Kingdom 2026`). Rows 2 to 4 are a three-row header. Row 4 reads: `Description | Code | (thousand) | Median | change | Mean | change | 10 | 20 | 25 | 30 | 40 | 60 | 70 | 75 | 80 | 90`. So the columns are: number of jobs (thousands, *indicative only*), median, annual % change in the median, mean, annual % change in the mean, and the percentiles.
- One row is one geography × occupation. Data runs from row 5 to about row 438 (433 rows). Blocks go: `United Kingdom` (code `'K02000001`), then its 9 one-digit and 26 two-digit SOC groups (35 occupation codes), then the same for each of 12 regions and nations (`'E12000001` … `'E12000009`, `'W92000004`, `'S92000003`, `'N92000002`), then `Not Classified`.
- Codes begin with an apostrophe and some have trailing spaces (`'E12000005 `): strip both. Descriptions repeat (`Process, plant and machine operatives` is both 8 and 81), so **key on the code, not the name**. Region rows' descriptions look like `Scotland, Elementary occupations`.
- Markers: `x` means unreliable (CV > 20%). The key also lists `..` = disclosive, `:` = not applicable and `-` = nil, but only `x` occurs in this edition. In the Full-Time sheet, 8 of 312 two-digit cells have a suppressed median. Map them to `null`.
- **Quality colour-coding is in cell styles, which our reader can't see.** To mark estimates as "reasonably precise" or "acceptable", read the `b` (CV) workbook: same layout, with CV % in place of values. ONS's bands are ≤5% precise, 5–10% reasonably precise, 10–20% acceptable, and over 20% shown as `x`.
- The rows below the data are footnotes (`a`, `b`, KEY, Source).

### Headline figures (checked)
- Median weekly pay, full-time employees, UK, April 2026 = Full-Time sheet, UK row: **£811.2**. Bulletin "Employee earnings in the UK: 2026": "Median weekly earnings for full-time employees were £811" ✓
- Median gross annual pay, full-time, tax year to April 2026 = Table 3.7a Full-Time UK: **£40,911.2**. Bulletin: £40,911 ✓
- All employees (full and part-time), median weekly £673.1, up 4.9%.

## B. Earnings and employment from PAYE Real Time Information, seasonally adjusted
- Page: https://www.ons.gov.uk/employmentandlabourmarket/peopleinwork/earningsandworkinghours/datasets/realtimeinformationstatisticsreferencetableseasonallyadjusted
  File: `…/current/rtisaoct2026.xlsx` (the name changes monthly: scrape the page)   Licence: OGL v3.0   Updates: monthly (next 17 November 2026)
- Coverage: UK, July 2014 to September 2026 (the latest month is a flash estimate), monthly.
- Files (in .cache/ons-pay/): `rtisaoct2026.xlsx`: 39 sheets, 1.5 MB
- Status: **accredited official statistics** (sheet `Index`, note 2; OSR confirmed this in July 2025).

### Tables
Every sheet has the same layout: row 0 is the title, row 1 the scope, row 3 `Units | …`. Data starts at row 6 or 7, with column A a month as text (`July 2014` … `September 2026`). These are the useful sheets:
- `1. Payrolled employees (UK)`: `Date | Payrolled employees | Change on previous month`, in people (not thousands).
- `2. Median pay (UK)`: `Date | Median pay`, in **£ per month**.
- `7. Employees (NUTS1)` / `8. Median pay (NUTS1)`: row 5 holds NUTS1 codes (`UKC` … `UKN`); row 6 reads `Date | North East | North West | Yorkshire and The Humber | East Midlands | West Midlands | East | London | South East | South West | Wales | Scotland | Northern Ireland | UK`. That's 12 regions and nations, plus the UK.
- `23. Employees (Industry)` / `24. Median pay (Industry)`: row 5 holds SIC sections `A` … `S`, `T-U`; row 6 has the names; the last column is the UK. That's 20 industries, and unlike vacancies it **includes agriculture (A)**.
- `29. Median pay (Age)`, `33. (NUTS1*age)`, `37. (NUTS1*sector)` exist too. The local authority sheets (19 to 22) are placeholders this month ("next update is on 15 December 2026").
- No suppression markers. Regions are allocated by the **employee's home address**; industries by the employer's PAYE scheme.

### Headline figures (checked)
- Payrolled employees, Aug 2025 to Aug 2026: 30,379,474 → 30,268,214, which is **−111,260**. Bulletin: "fell by 111,000 (0.4%)" ✓
- September 2026 flash = 30,280,860. Bulletin: "30.3 million" ✓
- UK median monthly pay, September 2026 = **£2,660** (£2,548 a year earlier, so +4.4%).

## Stories this could tell
- **The London premium.** Full-time median weekly pay is £1,038 in London against £723 in the North East, about 44% more. Scotland (£825) is second, ahead of the South East (£822). The RTI monthly medians tell the same story (£3,119 against £2,524) and are up to date each month.
- **The pay ladder by job.** Among two-digit occupations (full-time, UK), corporate managers and directors earn £1,330 a week; sales occupations earn £559. Caring personal service occupations (£587) sit near the bottom. That links to the care worker visa story, worded neutrally as "among the lowest-paid occupation groups".
- **Which industries pay least, by month.** RTI median monthly pay is £1,444 in accommodation and food against £4,332 in finance. That's monthly pay, so part-time work drags hospitality down: say so.
- **Payrolled employees have stopped growing.** 30.27 million in August 2026, down 111,000 on the year, but still 1.2 million above February 2020 (29.05 million). This is the admin-data counterweight to the LFS.

## Traps
- **ASHE counts jobs, not people.** Someone with two jobs appears twice. Its "number of jobs" column is indicative only: never quote it as a count.
- **Medians don't add or average.** Don't compute a UK figure from regions.
- **Weekly vs hourly vs annual.** Full-time weekly is ONS's headline measure. "All employees" mixes full- and part-time, so differences between groups partly reflect hours. Hourly pay is the fairest comparison across sexes and hours.
- **The 2026 ASHE is provisional** and will be revised in autumn 2027. The SOC 2020 series starts in 2021, so there's a break before that. The 2020–21 figures include furloughed employees.
- **RTI**: the latest month is a flash estimate and is revised heavily. Monthly pay includes part-time work and is **not** comparable with ASHE weekly pay. Median pay can rise just because the mix of jobs changes. RTI includes only PAYE employees, so no self-employed people.
- **Codes differ.** The region names match, but ASHE uses GSS codes (E12…) and RTI uses NUTS1 codes (UKC…UKN). Map them explicitly. The ASHE region is the place of work; the RTI region is the place of residence.
- Nominal pounds: neither source is adjusted for inflation. Call it "pay before inflation", or deflate with CPIH and say so.
