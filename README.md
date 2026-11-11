# cronpeek

> Explain a cron expression and show its next run times. Zero-dependency CLI.

[![CI](https://github.com/printemps-tokyo/cronpeek/actions/workflows/ci.yml/badge.svg)](https://github.com/printemps-tokyo/cronpeek/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)

`cronpeek` answers "what does this cron line do, and when does it next run?"
without leaving the terminal:

```console
$ cronpeek "*/15 9-18 * * 1-5"
# cron: */15 9-18 * * 1-5

Timezone: Asia/Tokyo

## Fields

- minute: 0, 15, 30, 45  (`*/15`)
- hour: 9, 10, 11, 12, 13, 14, 15, 16, 17, 18  (`9-18`)
- day of month: every  (`*`)
- month: every  (`*`)
- day of week: 1 (Mon), 2 (Tue), 3 (Wed), 4 (Thu), 5 (Fri)  (`1-5`)

## Next 5 runs

1. 2026-06-22 09:00 Mon (in 16h 42m)
2. 2026-06-22 09:15 Mon (in 16h 57m)
...
```

It is fully offline and has no runtime dependencies.

## Requirements

- Node.js >= 22

## Install

Not published to npm yet — install from source:

```bash
git clone https://github.com/printemps-tokyo/cronpeek
cd cronpeek
npm install && npm run build
npm link   # optional: puts the `cronpeek` command on your PATH
```

Then run `cronpeek …` (after `npm link`), or `node dist/cli.js …` from the clone.

## Usage

```bash
cronpeek "*/15 9-18 * * 1-5"          # explain + next 5 runs (local time)
cronpeek --next 10 "0 2 * * *"        # next 10 runs
cronpeek --tz Asia/Tokyo "30 2 * * 0" # in a specific timezone
cronpeek "@daily" --json              # machine-readable (same as --format json)
cronpeek --from 2026-06-22T00:00 "0 9 * * 1"  # runs after a given time
```

| Option | Description | Default |
| --- | --- | --- |
| `<expression>` | A 5-field cron expression or an `@alias`. Quote it. | required |
| `--next <n>` | How many upcoming runs to show | `5` |
| `--tz <zone>` | IANA timezone (e.g. `Asia/Tokyo`) | system timezone |
| `--from <when>` | Compute runs after this local time (`YYYY-MM-DDTHH:MM`) | now |
| `--format <md\|json>` | Output format | `md` |
| `--json` | Shorthand for `--format json` | — |
| `-o, --output <file>` | Write to a file | stdout |

## Supported syntax

- Fields: `minute hour day-of-month month day-of-week`.
- `*`, steps (`*/5`, `1-9/2`), ranges (`1-5`), and lists (`1,15,30`).
- Month names `JAN`-`DEC` and weekday names `SUN`-`SAT` (case-insensitive).
  Both `0` and `7` mean Sunday.
- Aliases: `@yearly`/`@annually`, `@monthly`, `@weekly`, `@daily`/`@midnight`,
  `@hourly`. (`@reboot` has no scheduled time, so it reports an error.)
- Day rule: like Vixie cron, when both day-of-month and day-of-week are
  restricted, a date matches if EITHER matches.

## Notes

- Times are computed in the chosen timezone (DST transitions are resolved by
  picking the adjusted instant). Pass `--tz` to override the system zone.
- Impossible dates (e.g. `0 0 30 2 *`) report no upcoming run within the search
  window rather than looping forever.

## Programmatic API

```ts
import { parseCron, nextRuns, describeSpec } from "@printemps-tokyo/cronpeek";

const spec = parseCron("*/15 9-18 * * 1-5");
const runs = nextRuns(spec, Date.now(), 5, "Asia/Tokyo");
const fields = describeSpec(spec);
```

The parser, matcher, scheduler, and renderers are pure functions.

## License

[MIT](./LICENSE) (c) printemps.tokyo
