# ONS: Labour market statistics time series (LMS), the dataset behind the monthly Labour market overview
- Page: https://www.ons.gov.uk/employmentandlabourmarket/peopleinwork/employmentandemployeetypes/datasets/labourmarketstatistics
  File: https://www.ons.gov.uk/file?uri=/employmentandlabourmarket/peopleinwork/employmentandemployeetypes/datasets/labourmarketstatistics/current/lms.csv (stable `current/` link; there's also `lms.xlsx`)
  Licence: OGL v3.0 (stated on the page)   Updates: monthly with the Labour market overview. This edition came out 20 October 2026; the next is 17 November 2026.
- Coverage: UK (the AWE series are Great Britain), 1971 to Jun–Aug 2026 for LFS rates. Monthly rows are rolling three-month averages; there are also quarterly and annual rows.
- Files (in .cache/ons-labour/): `lms.csv`: about 1,830 series side by side, 11.7 MB. (I tried A01, `a01oct2026.xls`, and dropped it. It's an old BIFF .xls that `xlsx.js`/`ods.js` can't read, and every A01 series is in lms.csv anyway.)
- Status: the LFS series are **official statistics** (their accreditation was removed in November 2023 and hasn't been restored). The page also carries Vacancy Survey, AWE and claimant count series.

## Tables
This is one wide CSV, not a set of sheets. Read it with `csv-parse`, `relax_column_count: true`.
- Rows 0 to 6 are metadata, one column per series: `Title`, `CDID`, `PreUnit`, `Unit`, `Release Date` (e.g. `20-10-2026`), `Next release`, `Important Notes`. Data starts at row 7 (`1891`, which is empty for almost every series).
- Column 0 holds the period label, in three formats in one column:
  - `YYYY`: annual. For some series this is "Annual = 4 quarter average".
  - `YYYY Qn`: calendar quarter.
  - `YYYY MON`: a **rolling three-month period, labelled by its middle month**. `2026 JUL` is June–August 2026, the bulletin's headline period, and `2026 MAY` is April–June, the same as `2026 Q2`. I checked this against the October 2026 bulletin (below).
- Missing values are empty strings: make them `null`. I found no `[x]` or `[c]` markers.
- Some titles and units contain embedded newlines (`"000s\n"`). Trim them.
- Pick series by **CDID**, never by column position. The ones worth using:

| CDID | What | Unit | Monthly range |
|---|---|---|---|
| LF24 | Employment rate, aged 16–64, SA | % | 1971 FEB – 2026 JUL |
| MGSX | Unemployment rate, aged 16+, SA | % | 1971 FEB – 2026 JUL |
| LF2S | Economic inactivity rate, 16–64, SA | % | 1971 FEB – 2026 JUL |
| MGRZ | People in employment, 16+, SA | thousands | 1971 – 2026 JUL |
| MGSC | Unemployed, 16+, SA | thousands | 1971 – 2026 JUL |
| LF2M | Economically inactive, 16–64, SA | thousands | 1971 – 2026 JUL |
| MGSV / LF25 | Employment rate 16–64, men / women | % | 1971 – 2026 JUL |
| MGWY | Unemployment rate, 16–24 | % | 1992 APR – 2026 JUL |
| LF63 / LF65 / LF69 / LF6B / LF67 | Inactive because: student / looking after family or home / long-term sick / retired / temporarily sick (16–64, thousands) | thousands | 1993 APR – 2026 JUL |
| MGRQ | Self-employed | thousands | 1992 – 2026 JUL |
| AP2Y | Vacancies, total (UK, thousands) | thousands | 2001 MAY – 2026 AUG |
| KAB9 / KAI7 | AWE, whole economy, total / regular pay, £ per week (GB) | £ | 2000 JAN – 2026 AUG |
| KAC3 | AWE total pay, year-on-year growth, 3-month average | % | 2001 – 2026 AUG |
| MGTM / LF9D | In employment / employment rate, **not** seasonally adjusted (these match EMP06's totals) | thousands / % | 1984/1992 – 2026 JUL |

- **Country of birth and nationality series are in here, but they're dead.** DSWD, DT2W, DT3B, DYTC and the rest stop at 2019 Q4. Use `ons-birth` (EMP06) for that subject.

## Headline figures (checked)
All match the "Labour market overview, UK: October 2026" bulletin:
- Employment rate 16–64, June–August 2026 = LF24 `2026 JUL` = **75.3%** (bulletin: 75.3%)
- Unemployment rate 16+, June–August 2026 = MGSX `2026 JUL` = **4.7%** (bulletin: 4.7%)
- Inactivity rate 16–64, June–August 2026 = LF2S `2026 JUL` = **20.9%** (bulletin: 20.9%)
- Vacancies, July–September 2026 = AP2Y `2026 AUG` = **691** thousand (bulletin: 691,000)
- AWE total pay growth = KAC3 `2026 AUG` = **3.7%** (bulletin: 3.7%)

## Stories this could tell
- **Fifty years of work in one line.** The employment rate is 75.3%, against a series high of 76.5% (Dec–Feb 2020) and a low of 65.6% (Feb–Apr 1983). The unemployment rate peaked at 11.9% in 1984. This is the strongest long-run chart on the site: rates, not levels, so it survives population growth.
- **Women in, men down.** Women's employment rate went from 52.6% (1971) to 72.4%; men's fell from 92.1% to 78.3%. The two lines converge, and that's a better hook than the flat total.
- **Why people aren't working.** 2.74 million people aged 16–64 are inactive because of long-term sickness, against 2.12 million in Nov–Jan 2020 and a peak of 2.85 million (Sep–Nov 2023). There are more students too (2.45 million). This is useful context for any immigration story, which often hinges on labour supply. Word it neutrally ("inactive because of long-term sickness"), with no blame.
- **Young people.** Unemployment among 16–24-year-olds is 15.6%, against a low of 9.3% (2022) and a high of 22.5% (2011). The lowest point was recent, which makes it surprising.
- **More people in work than ever, at a rate below the peak.** MGRZ is a record 34.58 million while LF24 sits below its 2020 high. That's population growth, and it gives a neat "level vs rate" explainer.

## Traps
- **LFS quality.** Response collapsed from 2020 to 2023. ONS reweighted the survey and says estimates from Jan–Mar 2025 include the full effect of its fixes, but "some volatility remains, particularly for estimates for mid-2023 and throughout 2024" and for small breakdowns. Every LFS section needs a method note saying the LFS is official statistics (not accredited) and that short-term changes should be read with caution. ONS asks people to read it alongside RTI payrolled employees and Workforce Jobs.
- **Rolling periods overlap.** `2026 JUL` and `2026 JUN` share two months. For "change on quarter", compare against the period three months back (`2026 APR`), as ONS does. For "on the year", use twelve back.
- **Labels.** Turn `2026 JUL` into "June to August 2026" in prose. Never call it "July 2026".
- **Before 1992**, monthly values come from ONS's historical back-series (the LFS was annual or biennial before 1992). The long-run chart is fine, but say "estimates before 1992 are modelled from earlier surveys".
- **Bases differ.** Employment and inactivity rates are for ages 16–64; the unemployment rate is for 16+ and is a share of the *economically active*, not of everyone. Say so in every method note.
- **Revisions.** Series are revised each month, so don't cache past values.
- **Geography.** The LFS is UK; AWE is Great Britain; vacancies are UK and exclude agriculture.
- **Annual rows** are sometimes a four-quarter average and sometimes missing. Don't mix annual and monthly rows in one chart.
