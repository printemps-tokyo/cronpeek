#!/usr/bin/env node
import { parseArgs } from "node:util";
import { readFile, writeFile } from "node:fs/promises";

import { parseCron } from "./parse.js";
import { nextRuns } from "./schedule.js";
import { renderJson, renderMarkdown } from "./render.js";
import { resolveFormat, type OutputFormat } from "./options.js";
import { assertTimeZone, systemTimeZone, zonedToInstant } from "./zoned.js";
import { usageError } from "./usage.js";
import { cronFromText } from "./text.js";
import { toSystemdCalendar } from "./systemd.js";
import { shortestGapMinutes, workflowSchedules } from "./workflow.js";
import { readdir, stat } from "node:fs/promises";
import { join } from "node:path";

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
  --text              Read the argument as a phrase ("every weekday at 9:30",
                      "毎週月曜 10時") and turn it into a cron expression
  --systemd           Also print the expression as systemd OnCalendar= lines
  --workflow <path>   Explain the schedules of a GitHub Actions workflow file,
                      or of every workflow in a folder (in UTC, or the
                      entry's timezone:)
  -h, --help          Show this help
  -v, --version       Show version

Examples:
  cronpeek "*/15 9-18 * * 1-5"
  cronpeek --next 10 --tz Asia/Tokyo "0 2 * * 0"
  cronpeek "@daily" --json
  cronpeek --text "every monday and thursday at 10am"
  cronpeek --systemd "*/15 9-18 * * 1-5"
  cronpeek --workflow .github/workflows
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
        text: { type: "boolean" },
        systemd: { type: "boolean" },
        workflow: { type: "string" },
      },
    });
    values = parsed.values;
    positionals = parsed.positionals;
  } catch (err) {
    process.stderr.write(usageError(err, "cronpeek"));
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

  // One cron expression explained: Markdown text, or a JSON object.
  const explain = (
    expression: string,
    timeZone: string,
    fromMs: number,
  ): { md: string; json: Record<string, unknown> } => {
    const spec = parseCron(expression);
    const runs = nextRuns(spec, fromMs, count, timeZone);
    let md = renderMarkdown(expression, spec, timeZone, runs, count, fromMs);
    const json = JSON.parse(renderJson(expression, spec, timeZone, runs)) as Record<string, unknown>;
    if (values.systemd) {
      const lines = toSystemdCalendar(spec, timeZone);
      md += `\n## systemd\n\n\`\`\`ini\n${lines.map((l) => `OnCalendar=${l}`).join("\n")}\n\`\`\`\n`;
      json.systemd = lines;
    }
    return { md, json };
  };

  let output: string;
  try {
    const timeZone = values.tz ?? systemTimeZone();
    assertTimeZone(timeZone);
    const fromMs = values.from ? parseFrom(values.from, timeZone) : Date.now();

    if (values.workflow !== undefined) {
      if (positionals.length > 0 || values.text) {
        throw new Error("--workflow takes no expression or --text");
      }
      const files = await workflowFiles(values.workflow);
      const mdParts: string[] = [];
      const jsonParts: Record<string, unknown>[] = [];
      for (const file of files) {
        const text = await readFile(file, "utf8");
        for (const entry of workflowSchedules(text)) {
          // GitHub runs a schedule in UTC unless the entry names a timezone.
          const tz = entry.timeZone ?? "UTC";
          assertTimeZone(tz);
          const one = explain(entry.cron, tz, fromMs);
          const spec = parseCron(entry.cron);
          const gap = shortestGapMinutes(nextRuns(spec, fromMs, 20, tz).map((r) => r.ms));
          const warning =
            gap !== undefined && gap < 5
              ? "GitHub runs scheduled workflows at most once every 5 minutes, so some of these runs will not happen."
              : undefined;
          mdParts.push(
            `<!-- ${file}:${entry.line} -->\n${one.md}${warning ? `\n> ${warning}\n` : ""}`,
          );
          jsonParts.push({ file, line: entry.line, ...one.json, ...(warning ? { warning } : {}) });
        }
      }
      if (jsonParts.length === 0) throw new Error(`no on.schedule cron entries in ${values.workflow}`);
      output = format === "json" ? JSON.stringify(jsonParts, null, 2) + "\n" : mdParts.join("\n");
    } else {
      // The expression may arrive as one quoted positional or five bare tokens.
      const given = positionals.join(" ").trim();
      if (given === "") {
        throw new Error('a cron expression is required (quote it, e.g. "*/5 * * * *")');
      }
      const expression = values.text ? cronFromText(given) : given;
      const one = explain(expression, timeZone, fromMs);
      if (values.text) {
        one.md = `> "${given}" -> \`${expression}\`\n\n${one.md}`;
        one.json = { text: given, ...one.json };
      }
      output = format === "json" ? JSON.stringify(one.json, null, 2) + "\n" : one.md;
    }
  } catch (err) {
    process.stderr.write(`error: ${(err as Error).message}\n`);
    return 1;
  }

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

/** A workflow file, or every .yml/.yaml file in a folder (sorted). */
async function workflowFiles(path: string): Promise<string[]> {
  const info = await stat(path).catch(() => {
    throw new Error(`cannot read "${path}"`);
  });
  if (!info.isDirectory()) return [path];
  const names = (await readdir(path)).filter((n) => /\.ya?ml$/i.test(n)).sort();
  return names.map((n) => join(path, n));
}
