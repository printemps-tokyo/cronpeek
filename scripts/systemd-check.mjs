/* global process, console */
// Check the OnCalendar= conversion against systemd itself: for each cron
// expression, the next runs systemd-analyze computes for the converted
// events must equal the next runs cronpeek computes for the cron. Needs a
// Linux machine with systemd-analyze and `npm run build`; run by CI.
import { execFileSync } from "node:child_process";
import { nextRuns, parseCron, toSystemdCalendar } from "../dist/index.js";

// Half a minute before midnight, so a run at 00:00 is the next one for both.
const BASE = "2026-11-11 23:59:30 UTC";
const baseMs = Date.parse("2026-11-11T23:59:30Z");
const COUNT = 6;
const CASES = [
  "*/15 9-18 * * 1-5",
  "0 0 * * *",
  "30 2 1 1,4,7,10 *",
  "0 9 1,15 * 1",
  "5 4 * * 0",
  "0 9 * * 0,6",
  "0 */3 * * *",
  "45 23 31 * *",
  "0 12 * 2 5-7",
];

const pad = (n) => String(n).padStart(2, "0");
let failed = 0;
for (const cron of CASES) {
  const spec = parseCron(cron);
  const want = nextRuns(spec, baseMs, COUNT, "UTC").map(
    (r) => `${r.year}-${pad(r.month)}-${pad(r.day)} ${pad(r.hour)}:${pad(r.minute)}:00`,
  );
  const got = [];
  for (const event of toSystemdCalendar(spec, "UTC")) {
    const out = execFileSync(
      "systemd-analyze",
      ["calendar", `--iterations=${COUNT}`, `--base-time=${BASE}`, event],
      { encoding: "utf8" },
    );
    // Every elapse line names its time as "Thu 2026-11-12 09:00:00 UTC";
    // the labels differ between systemd versions, so only the times count.
    for (const m of out.matchAll(/\b[A-Z][a-z]{2} (\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}) UTC\b/g)) {
      got.push(m[1]);
    }
  }
  const merged = [...new Set(got)].sort().slice(0, COUNT);
  const ok = JSON.stringify(merged) === JSON.stringify(want);
  console.log(`${ok ? "ok  " : "FAIL"} ${cron} -> ${toSystemdCalendar(spec, "UTC").join(" | ")}`);
  if (!ok) {
    failed++;
    console.log(`     systemd:  ${merged.join(", ")}\n     cronpeek: ${want.join(", ")}`);
  }
}
process.exit(failed ? 1 : 0);
