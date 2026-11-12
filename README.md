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
cronpeek --text "every weekday at 9:30"         # a phrase -> 30 9 * * 1-5
cronpeek --text "毎週月曜と木曜 10時"            # Japanese too -> 0 10 * * 1,4
cronpeek --systemd "*/15 9-18 * * 1-5"          # also as systemd OnCalendar=
cronpeek --workflow .github/workflows           # every schedule: in your workflows
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
| `--text` | Read the argument as a schedule phrase and turn it into cron | off |
| `--systemd` | Also print the expression as systemd `OnCalendar=` lines | off |
| `--workflow <path>` | Explain the `on.schedule` entries of a GitHub Actions workflow file, or of every `.yml`/`.yaml` in a folder | — |

### From a phrase

`--text` knows a small grammar and refuses anything else rather than guess:
`every minute`, `every 15 minutes`, `every hour [at :20]`, `every 6 hours`,
`daily`, `every day at 7am`, `every day at 9 and 18`, `every weekday at 9:30`,
`weekends at noon`, `every monday and thursday at 10am`, `on the 1st at 9:00`,
`monthly on day 15 at midnight`; and in Japanese `毎分`, `5分ごと`, `毎時30分`,
`3時間おき`, `毎日 9時`, `毎日9時半`, `平日 午後6時`, `土日 10時`,
`毎週月曜と木曜 10時`, `毎月1日 午前9時`, `毎日 9時、18時`. Several times must
share their minute (cron has one minute field per line).

### systemd timers

`--systemd` writes the schedule as `OnCalendar=` values (systemd.time(7)): the
matched values as lists and `a..b` ranges, weekdays Monday first, with the
`--tz` zone. Cron runs on a day when the day of the month or the weekday
matches (if both are restricted), while systemd needs both, so such a schedule
becomes two `OnCalendar=` lines, which a timer runs at either. CI checks the
conversion: for a set of expressions, the next runs `systemd-analyze calendar`
computes must equal cronpeek's.

### GitHub Actions

`--workflow` reads `- cron:` entries (and an entry's `timezone:`) from workflow
YAML with a line-based reader, not a full YAML parser, and explains each in UTC
(GitHub's default) or the entry's time zone. A schedule whose runs come less
than 5 minutes apart is flagged: GitHub runs scheduled workflows at most once
every 5 minutes.

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
