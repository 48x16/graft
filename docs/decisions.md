# Decisions

Judgements made without asking, newest last, with the reason for each.

- Name "Graft", tagline "Who works, who arrives, and what the official figures say.".
- Style: the user asked for "more of a gritty style". Applied visually: newsprint paper (#f3f0e8) with a faint grain, Oswald condensed capitals for headings, thick black rules, a black masthead plate, kickers stamped in red. Stamp red #b3261e replaces the magenta accent (5.8:1 on the paper). Light only, still.
- Voice: gritty means terse and direct, not loaded. The neutrality rules in docs/editorial.md still apply in full.
- Folder C:\Users\richy\SourceCode\graft; dev server on port 5180.
- Plan: seven features (jobs, pay, born-abroad, net-migration, visas, asylum, small-boats) and one tool (asylum-support). One over the "about 6" asked for: labour market plus vacancies and pay each fill four or five sections, so merging them would overload a page; small boats and returns share a page instead.
- Titles kept to 2 or 3 words for the gritty voice: Who Works, Pay Packet, Born Abroad, In and Out, Visas Issued, Asylum Claims, Boats and Returns, Support by Area. "Papers Please" rejected for visas as loaded. Name and tagline unchanged.
- All Home Office series are shown as years ending June, built from quarters, so the half-year 2026 is never set against full calendar years.
- Rates and shares are stored as fractions 0 to 1 in every JSON, to suit formatPercent.
- Net migration "highest/lowest" claims only within periods from year ending June 2021 (ONS method break).
- Asylum grant rate uses main applicants (cases), the publisher's definition; claims, awaiting and support use people. "Admin - Deceased" outcomes are dropped from every count, not just hidden.
- Asylum nationality list is ordered by number of claims, with rates printed alongside only where at least 50 decisions; no ordering by rate.
- No foreign national offender tables, NRM outcome tables or any deaths data are read.
- born-abroad owns pipeline/lib/xls.js (BIFF8 reader for EMP06). Series use the latest quarter's same quarter in each year (NSA); 2020 to 2022 marked as extreme caution.
- Support by Area tool: per-area counts of 10 or more are rounded to the nearest 5 and 1 to 9 shown as "fewer than 10", so a banded cell cannot be recovered by subtraction from an exact total. Region and UK totals exact. No ranking of areas, and no per-1,000 rate (no population source among the briefs). Trend starts 30 June 2023 (after the April 2023 boundary changes) and excludes subsistence-only support, which had no area recorded from December 2023 to December 2024.
- Returns compared with arrivals only side by side, never as a share (different dates).
- Pay page's ready selector corrected to `#region-bars .mag-bar` (the class charts.js emits).
