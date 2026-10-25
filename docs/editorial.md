# Editorial rules

The magazine's voice: confident, plain, curious. Short titles (2 to 4 words), a one-line
standfirst, sections that each answer one question. It reads like a good magazine's data page,
not a government report and not a campaign leaflet.

## Every figure comes from the data

- Every sentence with a number is built in code from the JSON, so it is still true after the
  next release. No figure is typed into HTML, titles, standfirsts or method notes.
- A sentence must survive the data changing direction: write both branches ("rose to … / fell
  to …", "the most since … / the fewest since …") rather than assuming the current trend.
- Check each sentence against the real numbers **and** against a small or empty case: one
  group, one year, a region with suppressed cells. If it can't be said honestly for small
  numbers, guard it (a threshold relative to the group's own size) or drop it.
- Round for prose (`roughly`: "1.2 million", "340,000"); give exact figures in tables.

## Say exactly what is counted

- Use the publisher's own measure and words: applications vs decisions vs grants vs people;
  visas vs people arriving; jobs vs people in work; "year ending June 2025" vs "2025".
- Name the geography every time it differs from the rest of the site (UK, Great Britain,
  England and Wales, England).
- Put a method note under every section: what's counted, the period, what's left out, and any
  break in the series ("a new collection from 2023, not comparable with earlier years").
- Shares need their base: "of decisions", "of applicants", "of people aged 16 to 64".
- Correlation is not cause. Two lines moving together get no "because".
- When the publisher marks figures as provisional or experimental (official statistics in
  development), say so in the method note.

## Sensitive subjects (immigration, asylum, health, crime, benefits)

- Neutral, precise vocabulary. Use the publisher's terms ("irregular migration", "small boat
  arrivals", "people granted protection", "returns"). Never: illegal immigrants, flood, wave,
  swarm, surge, influx, crisis, scroungers, or any metaphor of water, war or disease.
- No ranking of nationalities, religions or ethnic groups as better or worse. Where the data
  is by nationality, show it as published (top nationalities by number, with rates where a
  base exists), with no adjectives.
- Political targets and promises are not the story; the measured change is. Don't score
  governments or parties.
- No deaths or casualty counts (the same rule as Rev Counter), unless the user explicitly asks.
- No data about identifiable individuals; respect the publisher's suppression ([c], small cells).
- People are people: "people granted asylum", "workers", "applicants", not "migrants" as a
  noun for everyone, and never "illegals".

## Licence

- Open Government Licence v3.0 or equally open (CC BY 4.0) only. Check the dataset page.
- Not allowed: anything "all rights reserved", "personal use only", API terms that forbid
  republishing, or data needing a login or key the reader can't get (e.g. DWP Stat-Xplore
  without a key, think-tank datasets like the Migration Observatory's).
- Credit every source in the footer (site.config.js `sources`) and on the About page.

## Design

- Light only: white paper, near-black ink, greys, magenta `#ca357c` as the one accent (the
  key figure, the marker, the series the story is about). Never propose dark mode.
- No chart relies on colour alone: greys differ by dash or position, values are printed, and
  every chart has a table or list twin.
- Prefer simple forms: ranked bars, a line over time, a heat table, tiles, small multiples.
  A map only if `area-map`-style geography is available and the story is about place.
