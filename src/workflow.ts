/**
 * The `on.schedule` entries of a GitHub Actions workflow: each `cron:` with
 * the `timezone:` of the same entry, if any. GitHub runs schedules in UTC
 * unless the entry names a time zone, and at most every 5 minutes.
 */

export interface WorkflowSchedule {
  /** 1-based line of the cron key. */
  line: number;
  cron: string;
  timeZone?: string;
}

function scalar(raw: string): string {
  const v = raw.replace(/\s+#.*$/, "").trim();
  const q = /^(['"])(.*)\1$/.exec(v);
  return q ? (q[2] as string) : v;
}

/** Find the schedule entries in workflow YAML text (a line-based reading, not a full YAML parser). */
export function workflowSchedules(text: string): WorkflowSchedule[] {
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  const out: WorkflowSchedule[] = [];
  for (let i = 0; i < lines.length; i++) {
    const item = /^(\s*)-\s+(cron|timezone)\s*:\s*(.*)$/.exec(lines[i] as string);
    if (!item) continue;
    const indent = (item[1] as string).length;
    const entry: Partial<WorkflowSchedule> = {};
    const take = (key: string, value: string, at: number): void => {
      if (key === "cron") {
        entry.cron = scalar(value);
        entry.line = at + 1;
      } else {
        entry.timeZone = scalar(value);
      }
    };
    take(item[2] as string, item[3] as string, i);
    // The rest of the same list item: deeper-indented key lines.
    while (i + 1 < lines.length) {
      const next = lines[i + 1] as string;
      const kv = /^(\s*)(cron|timezone)\s*:\s*(.*)$/.exec(next);
      if (!kv || (kv[1] as string).length <= indent) break;
      take(kv[2] as string, kv[3] as string, i + 1);
      i++;
    }
    if (entry.cron !== undefined && entry.line !== undefined) {
      out.push({ line: entry.line, cron: entry.cron, ...(entry.timeZone ? { timeZone: entry.timeZone } : {}) });
    }
  }
  return out;
}

/** The shortest gap between consecutive runs, in minutes, from a list of run times (ms). */
export function shortestGapMinutes(runsMs: number[]): number | undefined {
  let best: number | undefined;
  for (let i = 1; i < runsMs.length; i++) {
    const gap = ((runsMs[i] as number) - (runsMs[i - 1] as number)) / 60_000;
    if (best === undefined || gap < best) best = gap;
  }
  return best;
}
