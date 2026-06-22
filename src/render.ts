import type { CronSpec } from "./parse.js";
import type { Run } from "./schedule.js";
import { describeSpec, weekdayLabel } from "./describe.js";
import { weekday } from "./match.js";

const pad = (n: number): string => String(n).padStart(2, "0");

/** Format a run's wall-clock as "YYYY-MM-DD HH:MM Www". */
export function formatRun(run: Run): string {
  const dow = weekdayLabel(weekday(run.year, run.month, run.day));
  return `${run.year}-${pad(run.month)}-${pad(run.day)} ${pad(run.hour)}:${pad(run.minute)} ${dow}`;
}

/** Render the explanation and upcoming runs as Markdown. */
export function renderMarkdown(expression: string, spec: CronSpec, timeZone: string, runs: Run[], count: number): string {
  const lines: string[] = [`# cron: ${expression}`, "", `Timezone: ${timeZone}`, "", "## Fields", ""];
  for (const f of describeSpec(spec)) {
    lines.push(`- ${f.label}: ${f.summary}  (\`${f.raw}\`)`);
  }
  lines.push("", `## Next ${count} runs`, "");
  if (runs.length === 0) {
    lines.push("_no upcoming run found_");
  } else {
    runs.forEach((run, i) => lines.push(`${i + 1}. ${formatRun(run)}`));
    if (runs.length < count) {
      lines.push("", `_(only ${runs.length} found within the search window)_`);
    }
  }
  return lines.join("\n") + "\n";
}

/** Render the explanation and upcoming runs as JSON. */
export function renderJson(expression: string, spec: CronSpec, timeZone: string, runs: Run[]): string {
  return (
    JSON.stringify(
      {
        expression,
        timeZone,
        fields: describeSpec(spec).map((f) => ({ field: f.label, raw: f.raw, summary: f.summary })),
        next: runs.map((run) => ({
          local: formatRun(run),
          iso: new Date(run.ms).toISOString(),
          epochMs: run.ms,
        })),
      },
      null,
      2,
    ) + "\n"
  );
}
