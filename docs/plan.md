# Graft: Who works, who arrives, and what the official figures say.

Seven features and one tool. Work half: `jobs`, `pay`, `born-abroad`. Immigration half:
`net-migration`, `visas`, `asylum`, `small-boats`. Tool: `asylum-support`.

## Conventions for every contract (binding)

- One file per page: `public/data/features/<page-id>.json`, written by `pipeline/<page-id>.js`.
  The tool also writes `public/data/asylum-support/index.json` and `<slug>.json`.
- **Rates and shares are fractions 0–1** (ONS 75.3% is stored as `0.753`), because
  `formatPercent` takes fractions. Counts are whole numbers in the publisher's unit, converted to
  **people** (ONS thousands × 1,000; EMP06 is already people). Pay is in pounds, not pence.
- **Arrays are oldest first.** Every series array is the same length as its period array and is
  aligned by index.
- `null` means "not available": suppressed (`x`, `*`, `..`), not yet published, or before the
  series starts. Never `0` for missing. `0` is a real zero (for ONS LTIM, "under 500").
- Home Office pages use **years ending June** built from quarters (YE June Y = Y-1 Q3 + Y-1 Q4 +
  Y Q1 + Y Q2), so the half-year 2026 is never compared with full calendar years. Each year
  object is `{ "year": 2026, "label": "year ending June 2026", "provisional": true }`.
  `provisional` is true when any of its quarters is provisional by the publisher's rule (stated
  per page).
- Rolling ONS periods carry both a machine key and a prose label: `"key": "2026-07"` (middle
  month), `"label": "June to August 2026"`.
- `updated`: a prose period string for the credits ("year ending June 2026").
- Lists ranked by number are sorted largest first and say so in their name (`top…`).

---

## jobs: Who Works
- kind: feature    icon: hard-hat    sources: ons-labour, ons-vacancies
- standfirst: Fifty years of work, worklessness and unfilled jobs, from the official surveys.
- ready: `#rate-table tbody tr`
- Data contract: public/data/features/jobs.json
  ```json
  {
    "updated": "June to August 2026",            // label of the latest LFS period (LF24)
    "lfs": {
      "periods": [{ "key": "1971-02", "label": "January to March 1971" }, …],  // every monthly rolling row in lms.csv from 1971 FEB to latest, oldest first
      "employmentRate": [0.72, …],               // LF24, 16–64, SA, fraction; null if blank
      "unemploymentRate": [0.039, …],            // MGSX, 16+, share of the economically active
      "inactivityRate": [0.24, …],               // LF2S, 16–64
      "menRate": [0.921, …],                     // MGSV employment rate men 16–64
      "womenRate": [0.526, …],                   // LF25 employment rate women 16–64
      "youthUnemploymentRate": [null, …, 0.156], // MGWY, 16–24; null before 1992 APR
      "inEmployment": [24900000, …]              // MGRZ, people (thousands × 1000)
    },
    "inactive": {                                // 16–64, SA, people; arrays aligned to lfs.periods, null before 1993 APR
      "longTermSick": […],                       // LF69
      "student": […],                            // LF63
      "familyHome": […],                         // LF65
      "retired": […],                            // LF6B
      "temporarySick": […]                       // LF67
    },
    "vacancies": {
      "updated": "July to September 2026",
      "periods": [{ "key": "2001-05", "label": "April to June 2001", "flag": null | "r" | "p" }, …],  // VACS02 levels rows, oldest first; key = middle month
      "total": [ … ],                            // B-S column (AP2Y), people
      "industries": [                            // the 18 SIC sections B…S only (no B-S, G-S, 45/46/47), order as in the sheet
        {
          "code": "Q", "name": "Health and social work",   // clean names from the SIC letter, not the sheet text
          "latest": 122000,                      // people, latest period
          "prePandemic": 137000,                 // the Dec-Feb 2020 period (key "2020-01")
          "peak": 216000, "peakLabel": "May to July 2022",  // own maximum over the whole series
          "openingsRate": 0.021 | null           // latest job openings rate sheet value, fraction
        }, …
      ],
      "openingsRateAll": 0.021                   // B-S job openings rate, latest
    }
  }
  ```
- Built from: ons-labour/lms.csv: columns by CDID (LF24, MGSX, LF2S, MGSV, LF25, MGWY, MGRZ, LF63, LF65, LF69, LF6B, LF67), rows with `YYYY MON` labels only (ignore `YYYY` and `YYYY Qn`); label = month before to month after the middle month. ons-vacancies/vacs02*.xlsx `levels` rows 8 until the first blank row, × 1000; `job openings rate` sheet latest row. Cross-check vacancies.total latest = AP2Y latest in lms.csv (log a warning on mismatch).

### Sections
1. **Fifty years in one line** (id: rate) — chart: line (employment rate s6, inactivity rate s2; table twin: every 12th period counting back from the latest, so each row is the same three months of each year).
   Sentence: "In {latest label}, {formatPercent(rate)} of people aged 16 to 64 in the UK were in work. That is {above/below/level with} a year earlier ({rate12}) and {n points} below the series high of {max} in {maxLabel}" / when latest is the high: "the highest on record".
   Method note: Labour Force Survey, UK, seasonally adjusted, rolling three-month periods. Estimates before 1992 are modelled from earlier surveys. The LFS is official statistics, not accredited; ONS says short-term changes, especially mid-2023 to 2024, should be read with caution.
   Small-data guard: compare with the period twelve back only if it exists and is non-null; say "level with" when the gap rounds to 0.0 points.
2. **Women in, men down** (id: sexes) — chart: line (menRate s1, womenRate s6).
   Sentence: "Women's employment rate has gone from {w0} in {firstLabel} to {wN}; men's {rose/fell} from {m0} to {mN}. The gap is now {gap} points, {narrower/wider} than the {gap0} points it was."
   Method note: employment rate of people aged 16 to 64, UK, seasonally adjusted; same LFS caveats.
   Small-data guard: use the first period where both are non-null.
3. **Out of work, not looking** (id: inactive) — chart: line (longTermSick s6, student s1, familyHome s2, retired s3, temporarySick s4).
   Sentence: "{roughly(longTermSick)} people aged 16 to 64 were economically inactive because of long-term sickness in {label}, {more/fewer} than in {label of key 2020-01} ({value}). The largest reason is now {top reason}." Neutral words only; no blame.
   Method note: inactive = neither in work nor looking and available; main reason as reported; 16–64; UK; from 1993; SA.
   Small-data guard: if the 2020-01 point is null, drop the comparison clause.
4. **Young and out of work** (id: youth) — chart: line (youthUnemploymentRate s6, unemploymentRate s2).
   Sentence: "{rate} of economically active 16 to 24-year-olds were unemployed in {label}, against {all} for everyone 16 and over. The lowest since the series began in {first} was {min} in {minLabel}; the highest {max} in {maxLabel}."
   Method note: unemployment is a share of the economically active (in work or looking), not of everyone in the age group; young people in full-time education count if they are looking for work.
   Small-data guard: if min and max are in the same period (one point), say only the latest.
5. **Unfilled jobs** (id: vacancies) — chart: line (total s6) then markedBars (industries, latest bar, mark = prePandemic, markText "before the pandemic").
   Sentence: "Employers reported {roughly(total)} vacancies in {label} (early estimate), {up/down} {n} on the three months before and {above/below} the {prePandemic} of December 2019 to February 2020. The peak was {peak} in {peakLabel}." Second: "{Industry with most} had the most, {oneIn(share)} of the total." Then: "{k} of 18 industries are below their pre-pandemic level."
   Method note: ONS Vacancy Survey of businesses, UK, rolling three months, thousands rounded; excludes agriculture, forestry and fishing, households and employment agencies; latest period provisional. Job openings rate is a new ONS measure from September 2026. Vacancies are not jobs filled and say nothing about who fills them.
   Small-data guard: percentage changes for an industry only when its latest level is at least 10% of its own peak and at least 5,000; otherwise give levels only. Empty industries list: `emptyNote()`.

## pay: Pay Packet
- kind: feature    icon: banknote    sources: ons-pay
- standfirst: What a week's work pays, by job and by region, before inflation.
- ready: `#region-bars .mag-bar`
- Data contract: public/data/features/pay.json
  ```json
  {
    "updated": "April 2026 (ASHE, provisional); September 2026 (PAYE)",
    "ashe": {
      "year": 2026, "provisional": true,
      "ukFullTimeWeekly": 811.2,                 // Table 3.1a Full-Time, UK row, median £/week
      "ukFullTimeWeeklyChange": 0.05 | null,     // annual % change of median, fraction
      "ukFullTimeAnnual": 40911.2,               // Table 3.7a Full-Time, UK median £/year
      "regions": [                               // the 12 regions/nations, order: largest median first
        { "code": "E12000007", "name": "London", "weekly": 1038.0, "weeklyChange": 0.04 | null, "hourly": 25.1 | null }, …
      ],                                         // weekly = 3.1a Full-Time median; hourly = 3.5a Full-Time median
      "occupations": [                           // UK, all 26 two-digit SOC 2020 groups, largest weekly first, nulls last
        { "code": "11", "name": "Corporate managers and directors", "major": "1", "weekly": 1330.0 | null, "hourly": 33.2 | null }, …
      ]
    },
    "rti": {
      "months": [{ "key": "2014-07", "label": "July 2014" }, …],  // oldest first; the last is a flash estimate
      "payrolled": [ … ],                        // sheet 1, people
      "medianMonthly": [ … ],                    // sheet 2, £ per month
      "flashLabel": "September 2026",
      "regions": [ { "code": "UKI", "name": "London", "medianMonthly": 3119 }, … ],  // sheet 8 latest row, 12 regions, largest first (UK column excluded)
      "industries": [ { "code": "I", "name": "Accommodation and food service activities", "medianMonthly": 1444 }, … ]  // sheet 24 latest row, A…S and T-U, largest first
    }
  }
  ```
- Built from: ons-pay ASHE zip Tables 3.1a, 3.5a, 3.7a, sheet `Full-Time`; key rows on stripped codes (`'K02000001`, `'E12…`); UK block two-digit codes are those with 2 digits under K02000001; `x` → null. RTI rtisa*.xlsx sheets 1, 2, 8, 24.

### Sections
1. **A week's pay** (id: headline) — chart: tiles (UK FT weekly median, FT annual median, RTI median monthly) plus line (rti.medianMonthly s6).
   Sentence: "The typical full-time employee in the UK earned {£weekly} a week in April {year}, {up/down} {change} on a year earlier, or {£annual} over the tax year." Second: "Across all PAYE employees, median monthly pay was {£} in {latest RTI month} (flash estimate), {up/down} {pct} on a year before."
   Method note: ASHE counts employee jobs (someone with two jobs counts twice), UK, April; 2026 is provisional. PAYE RTI covers payrolled employees only (no self-employed) and mixes full and part-time; the latest month is revised. Pay before inflation.
   Small-data guard: if weeklyChange is null, omit the clause; RTI comparison uses the month 12 back only if present.
2. **London and the rest** (id: region) — chart: bars (ASHE regions weekly).
   Sentence: "Full-time pay was highest in {top} ({£}) and lowest in {bottom} ({£}), a gap of {pct}. {Second} came next." Use "highest/lowest median"; regions are places of work.
   Method note: ASHE full-time median gross weekly pay, region of the workplace, April {year}. Medians do not average to the UK figure.
   Small-data guard: if fewer than two non-null regions, show the table only.
3. **The pay ladder** (id: occupation) — chart: bars (occupations weekly; nulls listed in the table as "not published").
   Sentence: "Among the 26 occupation groups, {top} had the highest full-time median ({£} a week) and {bottom} the lowest ({£}). Caring personal service occupations earned {£}, {rank phrase: 'among the lowest-paid quarter of groups' / 'in the middle' / 'in the top half'}."
   Method note: SOC 2020 two-digit groups, UK, full-time employees; ONS withholds estimates it judges unreliable (shown as not published). The SOC 2020 series starts in 2021.
   Small-data guard: rank phrase from the position among non-null groups; skip the caring clause if code 61 is null.
4. **Payroll count** (id: payroll) — chart: line (rti.payrolled s6).
   Sentence: "{roughly(n)} people were on PAYE payrolls in {month} (flash estimate), {up/down} {roughly(change)} on a year earlier and {above/below} February 2020 ({value})." Then industries: "Median monthly pay ranged from {£} in {lowest industry} to {£} in {highest}; monthly pay includes part-time work, which pulls some industries down."
   Method note: HMRC PAYE Real Time Information, UK, seasonally adjusted, accredited official statistics; region by employee's home; industry by employer.
   Small-data guard: skip the February 2020 clause if absent; industries list empty → `emptyNote()`.

## born-abroad: Born Abroad
- kind: feature    icon: globe    sources: ons-birth
- standfirst: How many people in work were born outside the UK, and how that mix has shifted.
- ready: `#share-table tbody tr`
- **Owns `pipeline/lib/xls.js`**: a small dependency-free BIFF8 reader (compound file, SST, LABELSST, NUMBER, RK, MULRK, FORMULA cached numbers; returns sheets as arrays of rows like `xlsx.js`). Unit-test it on the fixture. Other pages must not depend on it.
- Data contract: public/data/features/born-abroad.json
  ```json
  {
    "updated": "April to June 2026",
    "quarter": "Apr-Jun",                        // calendar quarter of the latest row; all series below use this same quarter in every year (NSA data)
    "quarterLabel": "April to June",
    "years": [1997, …, 2026],                    // years that have this quarter, oldest first
    "caution": ["none" | "reweight" | "pandemic", …],  // per year: "pandemic" for 2020–2022, "reweight" for the first year at/after Jan–Mar 2019 step (2019 only), else "none"
    "levels": {                                  // people aged 16+, Country of birth levels sheet, by CDID
      "total": [ … ],                            // MGTM (includes not stated)
      "ukBorn": [ … ],                           // JF6F
      "nonUkBorn": [ … ],                        // JF6G
      "euBorn": [ … ],                           // EQ4Q (column D only)
      "nonEuBorn": [ … ]                         // EQ4S
    },
    "rates": {                                   // employment rate, people aged 16–64, fraction
      "total": [ … ], "ukBorn": [ … ], "nonUkBorn": [ … ], "euBorn": [ … ], "nonEuBorn": [ … ]
    },
    "nationality": {                             // Nationality Levels sheet, same years
      "uk": [ … ], "nonUk": [ … ]                // JF6H, JF6I
    }
  }
  ```
  `*` and `..` → null. Any value null makes its year's share null.
- Built from: ons-birth/emp06*.xls via `pipeline/lib/xls.js`; sheets `Country of birth levels`, `Country of birth rates`, `Nationality Levels`; CDIDs from row 10; quarter labels parsed with `/^([A-Z][a-z]{2})-([A-Z][a-z]{2}) (\d{4})/` (footnote digits stripped). Rates ÷ 100.

### Sections
1. **One in five** (id: share) — chart: line (nonUkBorn / total share s6), tiles in the hero (share, nonUkBorn level).
   Sentence: "{oneIn(share)} people in work in the UK in {quarterLabel} {year} were born abroad: {roughly(nonUkBorn)} of {roughly(total)}. In {firstYear} it was {oneIn(share0)}." (Use formatPercent if oneIn gives an awkward value.)
   Method note: Labour Force Survey, UK, people aged 16+ in employment, not seasonally adjusted, same quarter each year. Total includes people who did not state a country of birth. Step change from 2019 (reweighting); extreme caution for 2020 to 2022 (pandemic non-response), marked on the chart by a dashed segment; LFS volatility mid-2023 to 2024. Official statistics, not accredited. Not a measure of arrivals.
   Small-data guard: share only where both values non-null.
2. **EU and beyond** (id: mix) — chart: line (euBorn s1, nonEuBorn s6).
   Sentence: "{roughly(eu)} people in work were born in the EU, {up/down} from {roughly(eu2016)} in {quarterLabel} 2016; {roughly(nonEu)} were born outside it, {up/down} from {roughly(nonEu2016)}." 2016 chosen as the comparison year; if absent, the first year.
   Method note: EU = the current EU27 throughout. Breakdowns below EU and non-EU stopped after 2019, so only these two groups are shown. Year-to-year moves in small groups are noisy; no quarter-to-quarter comment. Workers born abroad are not described as filling, taking or displacing jobs.
   Small-data guard: if 2016 is null, use the first non-null year.
3. **The rate gap** (id: rates) — chart: line (ukBorn s1, nonUkBorn s6, euBorn s2, nonEuBorn s3).
   Sentence: "{rN_non} of people aged 16 to 64 born abroad were in work, against {rN_uk} of those born in the UK: {higher/lower/the same}. In {firstYear} the figures were {r0_non} and {r0_uk}." Both branches computed; no ranking words beyond higher/lower.
   Method note: employment rate = people in work as a share of all people aged 16 to 64 in each group (rates use 16–64, levels 16+).
   Small-data guard: "about the same" when the gap is under 0.5 points.
4. **Born abroad, or not British** (id: nationality) — chart: bars (latest: born abroad vs non-UK nationality).
   Sentence: "{roughly(nonUkBorn)} people in work were born abroad, but {roughly(nonUk nationality)} hold a non-UK nationality: many people born abroad are British citizens."
   Method note: nationality as stated in the survey; same LFS caveats. Branch: if nationality ≥ born-abroad (unexpected), say "{a} were born abroad and {b} hold a non-UK nationality" without the "many" clause.
   Small-data guard: skip the section sentence (emptyNote) if either value is null.

## net-migration: In and Out
- kind: feature    icon: arrow-left-right    sources: ons-ltim
- standfirst: How many people came to live in the UK, how many left, and why.
- ready: `#net-table tbody tr`
- Data contract: public/data/features/net-migration.json
  ```json
  {
    "updated": "year ending December 2025",
    "periods": [                                 // Table 1 rows, every rolling quarter, oldest first
      { "key": "2012-06", "label": "year ending June 2012", "provisional": false, "revised": false, "newMethod": false }, …
    ],                                           // newMethod = true from YE June 2021 (series break)
    "flows": {                                   // Table 1, people (rounded to nearest 1,000 by ONS)
      "immigration": { "all": [ … ], "british": [ … ], "euPlus": [ … ], "nonEuPlus": [ … ] },
      "emigration":  { "all": [ … ], "british": [ … ], "euPlus": [ … ], "nonEuPlus": [ … ] },
      "net":         { "all": [ … ], "british": [ … ], "euPlus": [ … ], "nonEuPlus": [ … ] }
    },
    "interval": { "label": "year ending December 2025", "net": 171000, "lower": 145000, "upper": 197000 },  // Table 2 latest net row
    "reasons": {                                 // Table 4b, non-EU+ nationals, reason on arrival
      "periods": [ { "key": "2019-06", "label": "year ending June 2019", "provisional": false }, … ],
      "immigration": { "work": [ … ], "workMain": [ … ], "workDependant": [ … ], "study": [ … ], "studyMain": [ … ], "studyDependant": [ … ], "family": [ … ], "humanitarian": [ … ], "asylum": [ … ], "other": [ … ] },
      "net":         { same keys }
    },
    "revision": {                                // Table 5, one period: the most recent YE December with a completed estimate, else the latest available
      "label": "year ending December 2024",
      "stages": [ { "stage": "First published", "net": 431000, "british": -77000 }, …, { "stage": "Latest", "net": 331000, "british": -257000 } ]  // net emigration as negative; "british" = British net
    }
  }
  ```
  `work` = All Work Related, `study` = All Study Related, `humanitarian` = All Humanitarian (subtotals; the main/dependant keys are their parts, never add both levels).
- Built from: ons-ltim/ltim-may2026.xlsx (URL from config), Tables 1, 2, 4b, 5; period labels parsed with `/^YE (\w{3}) (\d\d)/`, flags from ` P` / ` R`; header text before `\r\n`; Table 5 revision-difference rows dropped.

### Sections
1. **Net migration** (id: net) — chart: line (immigration s1, emigration s2, net s6), with a vertical rule note at YE June 2021.
   Sentence: "Net migration to the UK was {roughly(net)} in the {label} (provisional): {roughly(imm)} people arrived to live here for a year or more and {roughly(emi)} left. That is {up/down} from {roughly(prevYear)} a year earlier. On current methods (since June 2021) the peak was {roughly(max)} in the {maxLabel}" / "this is the highest on current methods".
   Method note: ONS long-term international migration, UK, rolling years ending each quarter, rounded to the nearest 1,000. Official statistics in development; the last four quarters are provisional and earlier ones were revised. Methods changed in June 2021: earlier figures are not directly comparable. The 95% range for the latest net figure is {lower} to {upper} (generated).
   Small-data guard: "highest/lowest" only within newMethod periods; prevYear = 4 periods back, if present.
2. **British people leaving** (id: groups) — chart: line (net by british s1, euPlus s2, nonEuPlus s6); bars for the latest period.
   Sentence: "In the {label}, net migration of British nationals was {signed roughly}, {euPlus phrase}, and non-EU+ nationals {phrase}." Phrase: negative → "{n} more left than arrived"; positive → "{n} more arrived than left"; 0 → "about as many arrived as left".
   Method note: EU+ = EU27 plus Norway, Iceland, Liechtenstein and Switzerland (from June 2021); British figures before June 2021 are not comparable; values under 500 show as 0.
   Small-data guard: chart and sentence from YE June 2021 only.
3. **Why people come** (id: reasons) — chart: line (reasons.immigration work s6, study s1, family s2, humanitarian s3, asylum s4, other s5).
   Sentence: "Of the {roughly(all)} non-EU+ nationals who arrived in the {label}, {roughly(study)} came to study and {roughly(work)} to work. Work-related arrivals were {roughly(peak)} at their peak in the {peakLabel}." Largest reason chosen from the data ("Study is now the largest reason" / whichever).
   Method note: non-EU+ nationals only, reason on arrival (later visa switches not counted); asylum = people who claimed asylum within a year of arriving, by any route; humanitarian = BN(O), resettlement and Ukraine schemes. Rounded, so parts need not add up.
   Small-data guard: skip reasons under 5,000 in prose.
4. **Dependants** (id: dependants) — chart: line (workDependant s6, studyDependant s1, workMain s2, studyMain s3).
   Sentence: "{roughly(workDep)} people arrived as dependants of work visa holders in the {label}, against {roughly(maxWorkDep)} in the {maxLabel}. Study dependants numbered {roughly(studyDep)}." Net branch: if net study dependants < 0: "more former study dependants now leave than arrive".
   Method note: non-EU+ nationals; dependant = arrived as the partner or child of a main applicant; reason on arrival.
   Small-data guard: values under 500 are 0: say "fewer than 500".
5. **First guesses move** (id: revisions) — chart: bars (revision.stages net).
   Sentence: "Net migration for the {label} was first published as {roughly(first)} and now stands at {roughly(latest)}, a revision of {roughly(diff)} {up/down}. Most of the change came from British emigration, revised from {a} to {b}" (only if |British change| > half of |net change|; else omit).
   Method note: ONS revises provisional estimates as 6 and then 12 months of travel data come in.
   Small-data guard: one stage only → emptyNote().

## visas: Visas Issued
- kind: feature    icon: stamp    sources: ho-visas, ho-work-occupation
- standfirst: Who gets a UK visa, what for, and the care worker route that rose and fell.
- ready: `#groups-table tbody tr`
- Data contract: public/data/features/visas.json
  ```json
  {
    "updated": "year ending June 2026",
    "years": [ { "year": 2006, "label": "year ending June 2006", "provisional": false }, …, { "year": 2026, … "provisional": true } ],  // provisional: contains a quarter from 2026 Q1 on (publisher: "2026 Q1 onwards provisional"), generically: the latest two quarters
    "grants": {                                  // Vis_D02, Case outcome = Issued, all applicant types, entry clearance visas
      "total": [ … ],
      "work": [ … ], "study": [ … ], "family": [ … ], "visitor": [ … ], "other": [ … ]   // by Visa type group
    },
    "work": {                                    // Visa type group = Work
      "main": [ … ], "dependant": [ … ]          // Applicant type Main Applicant / Dependant; "All" rows (if any) → null for that year
    },
    "grantRate": { "work": 0.90, "study": 0.95, "family": 0.86, "visitor": 0.80, "all": 0.85 },  // latest YE, Issued / (Issued + Refused)
    "quarters": [ { "key": "2020 Q4", "label": "October to December 2020", "provisional": false }, … ],  // 2020 Q4 to latest
    "routes": {                                  // aligned to quarters; Visa type subgroup
      "healthCareMain": [ … ], "healthCareDependant": [ … ],   // "Health and Care Worker"
      "skilledMain": [ … ], "skilledDependant": [ … ]          // "Skilled Worker"
    },
    "routeShares": {                             // latest YE
      "healthCare": { "main": 7228, "dependant": 26915 },
      "skilled":    { "main": 26894, "dependant": 34226 }
    },
    "occupation": {                              // ho-work-occupation Data_Occ_D02, main applicants only
      "years": [ { "year": 2022, "label": "year ending June 2022", "provisional": false }, … ],  // first full YE from 2021 Q1
      "healthCareByGroup": {                     // Health and Care Worker grants by SOC minor group, aligned to occupation.years
        "care": [ … ],                           // 613 Caring Personal Services
        "nurses": [ … ],                         // 223 Nursing and Midwifery Professionals
        "doctors": [ … ],                        // 221 Medical Practitioners
        "other": [ … ]                           // all other minor groups
      },
      "topJobs": [ { "code": "2211", "name": "Generalist medical practitioners", "grants": 3126 }, … ],  // latest YE, Skilled Worker + Health and Care Worker, SOC unit group, top 15 by grants, excluding "*"
      "sponsoredRoutes": [ { "route": "Seasonal Worker", "grants": 41735 }, { "route": "Skilled Worker", … }, { "route": "Health and Care Worker", … }, { "route": "Other sponsored routes", … } ],  // latest YE, all sponsored main applicants; largest first, "Other" last
      "sponsoredTotal": 106685
    }
  }
  ```
- Built from: ho-visas Data_Vis_D02 (header row 3), quarters summed to YE June; route quarters by subgroup and applicant type. ho-work-occupation Data_Occ_D02: split hierarchy labels on the first " - "; merge the duplicate "Administrative and Support Activities" label; Seasonal subgroup "Seasonal Worker (previously Tier 5)" → "Seasonal Worker". Cross-check YE June 2026 work grants against Vis_01 if the ODS is present (warn only).

### Sections
1. **What visas are for** (id: groups) — chart: line (work s6, study s1, family s2, visitor s3, other s4) with table twin by year; hero tiles: total, visitor share, work.
   Sentence: "The UK issued {roughly(total)} entry clearance visas in the {label}. {oneIn/percent} were visitor visas; {roughly(study)} were for study and {roughly(work)} for work." Order study/work by size in code.
   Method note: entry clearance visas granted (applications made outside the UK), all applicant types; visas are not arrivals and some go unused. In-UK extensions and switches are counted separately and not shown. 2026 quarters are provisional. Grant rates: issued as a share of issued plus refused.
   Small-data guard: share sentence only if total > 0.
2. **Work visas: peak and fall** (id: work) — chart: line (work.main s6, work.dependant s1).
   Sentence: "{roughly(work)} work visas were issued in the {label}, including dependants: {up/down} {pct} on a year earlier, and {the fewest since the {year} / the most since …} . The peak was {roughly(max)} in the {maxLabel}."
   Method note: Work visa type group; dependants are partners and children, assigned to the main applicant's route, and may join a worker who arrived in an earlier year.
   Small-data guard: "fewest/most since" scans back for the last year beyond the value; if none, "the fewest/most in the series".
3. **The care worker years** (id: care) — chart: line (routes.healthCareMain s6, skilledMain s1, quarterly from 2020 Q4).
   Sentence: "Health and Care Worker visas for main applicants peaked at {n} in {peakQuarter label}; in {latest quarter label} {n} were issued." Second, occupation: "Visas for caring personal services went from {care at its max YE} in the {label} to {care latest} in the {latest label}; doctors are now the largest group on the route" (largest group computed: "{group} are now the largest group").
   Method note: route opened December 2020 (earlier Tier 2 not joined). Dated facts only: care workers could no longer bring dependants from 11 March 2024; overseas recruitment for care workers and senior care workers closed on 22 July 2025. Occupation data: main applicants only, matched to a Certificate of Sponsorship, so totals are a little below the visa figures; 2021 Q1 to 2024 Q3 modelled; not accredited official statistics; 2026 provisional.
   Small-data guard: if fewer than 4 quarters, skip "peaked".
4. **Family members** (id: dependants) — chart: bars (latest YE main vs dependant for each of the two routes).
   Sentence: "{formatPercent(depShare)} of Health and Care Worker visas in the {label} went to dependants ({n} against {m} main applicants), and {pct} of Skilled Worker visas." Never "per worker".
   Method note: many dependants join workers granted visas in earlier years, so this is not a family size.
   Small-data guard: share only when the route's total ≥ 100; else counts only.
5. **The jobs behind the visas** (id: jobs) — chart: bars (topJobs) then bars (sponsoredRoutes).
   Sentence: "{topJobs[0].name} had the most Skilled Worker and Health and Care Worker visas in the {label} ({n}), followed by {second} and {third}." Second: "{Largest sponsored route} accounted for {roughly(n)} of {roughly(total)} sponsored work visas for main applicants" + if Seasonal is first: ", more than Skilled Worker and Health and Care Worker together" only when true.
   Method note: SOC 2020 unit groups, main applicants only; unit-group detail starts October 2024; industry is assigned by the sponsor; seasonal workers come for up to six months, mostly in horticulture.
   Small-data guard: topJobs empty → emptyNote(); show fewer than 15 if fewer exist.

## asylum: Asylum Claims
- kind: feature    icon: scale    sources: ho-asylum
- standfirst: Claims, decisions and the queue in between, quarter by quarter.
- ready: `#claims-table tbody tr`
- Data contract: public/data/features/asylum.json
  ```json
  {
    "updated": "year ending June 2026",
    "years": [ { "year": 2002, "label": "year ending June 2002", "provisional": false }, … ],  // YE June 2002 to latest; provisional = includes 2026 Q1 or later (latest two quarters)
    "claims": { "people": [ … ], "mainApplicants": [ … ] },      // Data_Asy_D01, all ages/sex/UASC/location; people = Main Applicant + Dependant; null for dependants in years before they're recorded (people null if any quarter lacks dependants)
    "decisions": {                                               // Data_Asy_D02, initial decisions, MAIN APPLICANTS ONLY (cases)
      "protection": [ … ], "otherLeave": [ … ], "refused": [ … ], "withdrawn": [ … ],
      "grantRate": [ 0.17, … ]                                   // (protection + otherLeave) / (protection + otherLeave + refused); null if denominator 0
    },
    "decisionsPeople": [ … ],                                    // all applicant types, all outcome groups EXCEPT Admin - Deceased rows (dropped entirely)
    "awaiting": {                                                // Data_Asy_D03, Pending initial decision ONLY, people (all applicant types)
      "dates": [ { "key": "2010-06-30", "label": "30 June 2010" }, … ],   // every quarter end, oldest first
      "people": [ … ], "cases": [ … ],                           // cases = Main Applicant rows
      "byDuration": { "under3m": [ … ], "3to6m": [ … ], "6to12m": [ … ], "12mPlus": [ … ] }   // people
    },
    "nationalities": [                                           // latest YE, top 10 by claims (people), excluding "Other"/"Unknown"; Refugee and Stateless allowed
      { "name": "Pakistan", "claims": 8305, "decisions": 9000, "grantRate": 0.25 | null }   // decisions = main-applicant grants+refusals; grantRate null when that base < 50
    ],
    "support": {                                                 // Data_Asy_D09
      "dates": [ { "key": "2014-03-31", "label": "31 March 2014" }, … ],
      "people": [ … ],                                           // all support types
      "hotels": [ … ]                                            // Accommodation Type = "Contingency Accommodation - Hotel"; null before first appearance
    }
  }
  ```
- Built from: ho-asylum Data_Asy_D01 (merge `Unknown Age`/`Unknown age`), Data_Asy_D02 (drop `Admin - Deceased`), Data_Asy_D03 (filter `Application stage = Pending initial decision`), Data_Asy_D09. Cross-check latest YE against Asy_00a if the ODS is present (warn only).

### Sections
1. **Claims** (id: claims) — chart: line (claims.people s6) with table twin by year.
   Sentence: "{roughly(people)} people claimed asylum in the UK in the {label}, {up/down} {pct} on the year before, and {the fewest/most since the {year}}." Peak clause: "The most in a year ending June was {roughly(max)} in {maxLabel}."
   Method note: people = main applicants plus dependants; claims made in the UK, at port or in country. 2026 quarters provisional. Decisions in a year do not relate to that year's claims.
   Small-data guard: "since" scan as in visas; skip pct if prior year null.
2. **The queue** (id: awaiting) — chart: line (awaiting.people s6, cases s1), plus bars (not stacked) of byDuration at the latest date.
   Sentence: "{roughly(people)} people ({roughly(cases)} cases) were waiting for an initial decision on {latest date label}, {formatPercent(change)} {lower/higher} than the peak of {roughly(max)} on {maxLabel}" / when latest is the peak: "the most on record". Second: "{share} had waited less than three months and {share} a year or more."
   Method note: claims awaiting an initial decision only (appeals and further reviews excluded throughout); people include dependants; cases are main applicants.
   Small-data guard: duration shares only when people ≥ 100.
3. **Grant rate** (id: rate) — chart: line (decisions.grantRate s6, formatValue percent).
   Sentence: "{formatPercent(rate)} of initial decisions on asylum claims in the {label} were grants of protection or other leave, {up/down} from {prev} a year earlier. Since {firstLabel} it has ranged from {min} ({minLabel}) to {max} ({maxLabel})."
   Method note: main applicants (cases), initial decisions only; grant rate = grants as a share of grants and refusals (withdrawals and administrative outcomes excluded); appeals can change outcomes and are not shown (the appeals series stopped in 2023).
   Small-data guard: skip a year whose denominator is under 100.
4. **Decisions by nationality** (id: nationality) — chart: bars (claims), with grant rate printed as text ("grant rate 25%").
   Sentence: "The most common nationality claiming asylum in the {label} was {name} ({roughly(n)} people). Among the ten most common nationalities, grant rates at initial decision varied from under {min} to over {max}." Order by number of claims only; no adjectives, no ranking by rate.
   Method note: top ten by number of people claiming; grant rates on main-applicant decisions in the same year (not necessarily the same people).
   Small-data guard: rate shown only where base ≥ 50, else "too few decisions"; empty list → emptyNote().
5. **On support** (id: support) — chart: line (support.people s1, hotels s6).
   Sentence: "{roughly(people)} people were receiving asylum support on {date}, {roughly(hotels)} ({pct}) of them in hotels: {up/down} {pct} on a year earlier."
   Method note: Home Office asylum support (Section 95, 4 and 98); from 2018 the figures are provisional (new system); excludes unaccompanied children supported by local authorities. Link to the Support by Area tool.
   Small-data guard: year-earlier comparison only if 4 dates back exists and hotels non-null.

## small-boats: Boats and Returns
- kind: feature    icon: sailboat    sources: ho-irregular, ho-returns
- standfirst: Small boat arrivals by month, who arrives, and who is returned from the UK.
- ready: `#month-heat tbody tr`
- Data contract: public/data/features/small-boats.json
  ```json
  {
    "updated": "year ending June 2026",
    "months": {                                  // IER_02a, strip "[Note n]" from labels
      "years": [2018, …, 2026],                  // rows of the heat table
      "arrivals": [[ 0, 0, …12 values ], …],     // [yearIndex][monthIndex 0–11], people; null for months not yet published
      "boats": [[ … ], …]                        // same shape
    },
    "perBoat": [ { "year": 2018, "label": "2018", "people": 299, "boats": 43, "perBoat": 7.0 }, …, { "year": 2026, "label": "January to June 2026", … } ],  // from months; perBoat null if boats 0; label "January to <last month> Y" for a part year
    "years": [ { "year": 2019, "label": "year ending June 2019", "provisional": false }, … ],  // YE June 2019 to latest (data start 2018 Q1); provisional = true for the latest YE only (recent quarters are revised each edition)
    "arrivals": [ … ],                           // Data_IER_D01, Method of entry = Small boat arrivals, people, aligned to years
    "detections": { "smallBoat": n, "air": n, "inCountry": n, "ports": n },  // latest YE, the four methods
    "nationalities": [ { "name": "Eritrea", "arrivals": 5875, "previous": 4000 | null }, … ],  // latest YE, top 10 by arrivals, excluding "Not currently recorded"; previous = the YE before
    "notRecorded": 1140,                         // latest YE "Not currently recorded" nationality
    "ageSex": { "male": n, "female": n, "unknownSex": n, "under18": n },  // latest YE; unknownSex includes "Not currently recorded"
    "claimed": [ { "year": 2018, "asylumOnly": 0.9, "asylumAndNrm": 0.05, "neither": 0.05, "arrivals": 299 }, … ],  // IER_02d by arrival calendar year, fractions of that year's arrivals
    "returns": {                                 // Data_Ret_D01, YE June, Return type group
      "years": [ { "year": 2005, "label": "year ending June 2005", "provisional": false }, … ],  // provisional = contains any of the latest 7 quarters
      "enforced": [ … ], "voluntary": [ … ], "refusedAtPort": [ … ]
    },
    "smallBoatReturns": {                        // Ret_06a quarter rows only (/^\d{4} Q\d/)
      "quarters": [ { "key": "2018 Q1", "label": "January to March 2018", "provisional": false }, … ],
      "returns": [ … ],
      "latestYear": 3310                          // sum of the latest four quarters
    }
  }
  ```
- Built from: ho-irregular IER_02a (summary ODS), Data_IER_D01, IER_02d; ho-returns Data_Ret_D01 (normalise case variants), Ret_06a. No foreign national offender tables (Ret_D03/D04, Ret_02c/d) are read. No NRM outcome tables. Nothing about deaths.

### Sections
1. **By month** (id: month) — chart: heat (years × months, arrivals), table twin is the heat table itself plus totals column.
   Sentence: "{roughly(arrivals)} people arrived in the UK on small boats in the {label}, {up/down} {pct} on the year before. The busiest month on record was {Month Year} ({n})." Season line: "{share} of {lastFullYear}'s arrivals came between May and October."
   Method note: detected small boat arrivals, people (not boats), by arrival date; official statistics, not accredited; recent months revised as records complete. Daily counts published elsewhere are not used.
   Small-data guard: season line only for a year with all 12 months and ≥ 100 arrivals.
2. **People per boat** (id: perboat) — chart: line (perBoat.perBoat s6, numeric x by year).
   Sentence: "Boats carried an average of {perBoat} people in {label}, against {first} in {firstLabel}." Both branches ("more/fewer").
   Method note: arrivals divided by boats detected in the same period; a part year is labelled as such.
   Small-data guard: skip years with fewer than 10 boats.
3. **Who arrives** (id: who) — chart: markedBars (nationalities, mark = previous, markText "the year before"), then tiles (male, female, under 18).
   Sentence: "The five most common nationalities made up {pct} of arrivals in the {label}: {list}." Age/sex: "{roughly(male)} were recorded as male and {roughly(female)} as female; {roughly(under18)} were recorded as aged 17 or under."
   Method note: nationality and age as recorded on arrival, revised after checks; {notRecorded} not yet recorded, included in totals but not the list; shown by number only.
   Small-data guard: list fewer than five if fewer exist; empty → emptyNote().
4. **Claiming asylum** (id: claimed) — chart: table (heat-free, by year) and bars for latest full year.
   Sentence: "Of {lastYear}'s small boat arrivals, {pct} claimed asylum (including {pct2} also referred as possible victims of modern slavery); {pct3} did neither."
   Method note: by arrival year; cohort figures update yearly; totals differ slightly from the arrivals counts (different extraction dates).
   Small-data guard: shares only if that year's arrivals ≥ 100.
5. **Returns** (id: returns) — chart: line (enforced s6, voluntary s1, refusedAtPort s2), then line (smallBoatReturns quarterly).
   Sentence: "There were {roughly(voluntary)} voluntary returns and {roughly(enforced)} enforced returns from the UK in the {label}; enforced returns were {up/down} {pct} on a year earlier and {above/below} their level in {firstLabel} ({n})." Second: "{n} people who arrived by small boat were returned in the last four quarters." No share-of-arrivals figure.
   Method note: returns are events, not people; the latest seven quarters are provisional and voluntary returns are revised upwards as records are matched; series breaks in 2010 and October 2020. Returns of small boat arrivals count the first return after arrival, by return date: not comparable with arrival dates; not accredited.
   Small-data guard: pct only if prior year ≥ 100.

---

## asylum-support: Support by Area
- kind: tool    icon: map-pin    sources: ho-asylum
- standfirst: Find how many people receive asylum support in a local authority.
- ready: `#area-table tbody tr`
- **Banding rule (pipeline, binding):** every per-area count is written as a Count object:
  `{ "n": 120, "band": null }` for counts of 10 or more, **rounded to the nearest 5**;
  `{ "n": null, "band": "fewer than 10" }` for 1 to 9; `{ "n": 0, "band": null }` for none.
  Region and UK totals are exact. The page prints `band` when `n` is null.
- Data contract:
  - public/data/asylum-support/index.json
    ```json
    {
      "updated": "30 June 2026",
      "areas": [ { "slug": "glasgow-city", "name": "Glasgow City", "code": "S12000049", "region": "Scotland" }, … ]  // every LAD code present at the latest date, sorted by name; slug = kebab of name (append -<code lowercase> on clash)
    }
    ```
  - public/data/asylum-support/<slug>.json
    ```json
    {
      "slug": "glasgow-city", "name": "Glasgow City", "code": "S12000049", "region": "Scotland",
      "date": "30 June 2026",
      "total": Count,                            // all support types and accommodation at the latest date
      "byAccommodation": [                       // latest date, fixed order, all six always present
        { "type": "Dispersal accommodation", "count": Count },
        { "type": "Initial accommodation", "count": Count },
        { "type": "Hotels", "count": Count },                 // Contingency Accommodation - Hotel
        { "type": "Other contingency accommodation", "count": Count },
        { "type": "Other accommodation", "count": Count },
        { "type": "Subsistence only", "count": Count }
      ],
      "trend": {                                 // accommodated people only (excludes Subsistence only, which has no area for Dec 2023 to Dec 2024)
        "dates": ["30 June 2023", …],            // every quarter end from 30 June 2023 to latest
        "accommodated": [Count, …],
        "hotels": [Count, …]
      },
      "regionTotal": 9800,                       // exact, same region, latest date, all support
      "ukTotal": 93293,                          // exact
      "shareOfUk": 0.042 | null                  // total.n / ukTotal from the UNROUNDED count; null when total is banded or 0
    }
    ```
- Built from: ho-asylum Data_Asy_D11: normalise case (`Yorkshire And The Humber`, `Subsistence only`); drop `N/A - …` placeholder rows; group by LAD Code. Trend from 30 June 2023 (after the April 2023 boundary changes) so codes are stable; an area with no rows at a date is 0.

### Sections
1. **The area** (id: area) — chart: tiles (total, hotels, share of UK) and table (byAccommodation), table `#area-table`.
   Sentence: "{n | 'Fewer than 10'} people were receiving asylum support in {name} on {date}. {If hotels n>0: 'Of these, {hotels} were in hotels.'} That is {formatPercent(share)} of everyone on asylum support in the UK" (omit share clause if null).
   Method note: Home Office asylum support by local authority, as at the date; counts of 10 or more rounded to the nearest 5, smaller counts shown as "fewer than 10"; excludes unaccompanied children supported by local authorities; Northern Ireland includes only people who claimed there. Provisional (from 2018).
   Small-data guard: banded total → no share, no hotel share; total 0 → "No one was receiving asylum support in {name} on {date}."
2. **Since 2023** (id: trend) — chart: line (accommodated s1, hotels s6; banded points drawn as null gaps, printed as "fewer than 10" in the table).
   Sentence: "{accommodated latest} people were in Home Office accommodation in {name} on {date}, {up/down from / about the same as} {first} on 30 June 2023." Only when both ends have n ≥ 10; else "Numbers here are too small to describe a trend."
   Method note: excludes subsistence-only support (no area recorded for part of the period); boundaries as at April 2023.
   Small-data guard: as above; no ranking of areas anywhere on the page.
3. **The region** (id: region) — chart: tiles (region total, UK total).
   Sentence: "{region} had {roughly(regionTotal)} people on asylum support on {date}, out of {roughly(ukTotal)} across the UK."
   Method note: region totals are exact; per-area counts are rounded, so they need not add up.
   Small-data guard: region "Unknown" or missing → omit the sentence.
