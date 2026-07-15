#!/usr/bin/env node
import { parseArgs } from "node:util";
import { readFile, writeFile } from "node:fs/promises";

import { parseCron } from "./parse.js";
import { nextRuns } from "./schedule.js";
import { renderJson, renderMarkdown } from "./render.js";
import { resolveFormat, type OutputFormat } from "./options.js";
import { assertTimeZone, systemTimeZone, zonedToInstant } from "./zoned.js";
import { usageError } from "./usage.js";

const HELP = `cronpeek - explain a cron expression and show its next run times

Usage:
  cronpeek [options] "<cron expression>"

Parses a 5-field cron expression (or an @alias like @daily), explains each
field, and prints the upcoming run times. Fully offline.

Options:
  --next <n>          How many upcoming runs to show (default: 5)
  --tz <zone>         IANA timezone, e.g. Asia/Tokyo (default: system timezone)
  --from <when>       Compute runs after this local time (YYYY-MM-DDTHH:MM)
                      interpreted in --tz (default: now)
  --format <md|json>  Output format (default: md)
  --json              Shorthand for --format json
  -o, --output <file> Write to a file (default: stdout)
  -h, --help          Show this help
  -v, --version       Show version

Examples:
  cronpeek "*/15 9-18 * * 1-5"
  cronpeek --next 10 --tz Asia/Tokyo "0 2 * * 0"
  cronpeek "@daily" --json
`;

async function readVersion(): Promise<string> {
  const { fileURLToPath } = await import("node:url");
  const { join, dirname } = await import("node:path");
  const here = dirname(fileURLToPath(import.meta.url));
  try {
    const raw = await readFile(join(here, "..", "package.json"), "utf8");
    return (JSON.parse(raw) as { version: string }).version;
  } catch {
    return "0.0.0";
  }
}

/** Parse a `YYYY-MM-DDTHH:MM` (or with a space) local time into an instant. */
function parseFrom(value: string, timeZone: string): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})$/.exec(value.trim());
  if (!m) {
    throw new Error(`--from must be YYYY-MM-DDTHH:MM (got "${value}")`);
  }
  const [, y, mo, d, h, mi] = m.map(Number) as unknown as number[];
  return zonedToInstant(timeZone, {
    year: y as number,
    month: mo as number,
    day: d as number,
    hour: h as number,
    minute: mi as number,
  }).getTime();
}

async function main(): Promise<number> {
  const argv = process.argv.slice(2);
  if (argv.includes("-h") || argv.includes("--help")) {
    process.stdout.write(HELP);
    return 0;
  }
  if (argv.includes("-v") || argv.includes("--version")) {
    process.stdout.write((await readVersion()) + "\n");
    return 0;
  }

  let values;
  let positionals;
  try {
    const parsed = parseArgs({
      args: argv,
      allowPositionals: true,
      options: {
        next: { type: "string" },
        tz: { type: "string" },
        from: { type: "string" },
        format: { type: "string" },
        json: { type: "boolean" },
        output: { type: "string", short: "o" },
      },
    });
    values = parsed.values;
    positionals = parsed.positionals;
  } catch (err) {
    process.stderr.write(usageError(err, "cronpeek"));
    return 1;
  }

  // The expression may arrive as one quoted positional or five bare tokens.
  const expression = positionals.join(" ").trim();
  if (expression === "") {
    process.stderr.write('error: a cron expression is required (quote it, e.g. "*/5 * * * *")\n\n' + HELP);
    return 1;
  }

  const count = values.next ? Number(values.next) : 5;
  if (!Number.isInteger(count) || count < 1) {
    process.stderr.write("error: --next must be a positive integer\n");
    return 1;
  }
  let format: OutputFormat;
  try {
    format = resolveFormat(values.format, values.json ?? false);
  } catch (err) {
    process.stderr.write(`error: ${(err as Error).message}\n`);
    return 1;
  }

  const timeZone = values.tz ?? systemTimeZone();
  let fromMs: number;
  let spec;
  try {
    assertTimeZone(timeZone);
    fromMs = values.from ? parseFrom(values.from, timeZone) : Date.now();
    spec = parseCron(expression);
  } catch (err) {
    process.stderr.write(`error: ${(err as Error).message}\n`);
    return 1;
  }

  const runs = nextRuns(spec, fromMs, count, timeZone);
  const output =
    format === "json"
      ? renderJson(expression, spec, timeZone, runs)
      : renderMarkdown(expression, spec, timeZone, runs, count, fromMs);

  if (values.output) {
    try {
      await writeFile(values.output, output, "utf8");
    } catch (err) {
      process.stderr.write(`error: cannot write "${values.output}": ${(err as Error).message}\n`);
      return 1;
    }
    process.stderr.write(`cronpeek: wrote ${values.output}\n`);
  } else {
    process.stdout.write(output);
  }
  return 0;
}

main()
  .then((code) => {
    process.exitCode = code;
  })
  .catch((err: unknown) => {
    process.stderr.write(`error: ${(err as Error).message}\n`);
    process.exitCode = 1;
  });
