import { describe, expect, it } from "vitest";
import { parseCron } from "../src/parse.js";
import { nextRuns } from "../src/schedule.js";
import { describeSpec } from "../src/describe.js";
import { renderMarkdown, renderJson, formatRun, formatDelta } from "../src/render.js";

describe("describeSpec", () => {
  it("summarizes fields with names and 'every'", () => {
    const fields = describeSpec(parseCron("*/15 9-18 * JAN 1-5"));
    const byLabel = Object.fromEntries(fields.map((f) => [f.label, f.summary]));
    expect(byLabel.minute).toBe("0, 15, 30, 45");
    expect(byLabel["day of month"]).toBe("every");
    expect(byLabel.month).toBe("1 (Jan)");
    expect(byLabel["day of week"]).toBe("1 (Mon), 2 (Tue), 3 (Wed), 4 (Thu), 5 (Fri)");
  });
});

describe("formatRun", () => {
  it("formats wall-clock with a weekday label", () => {
    const runs = nextRuns(parseCron("0 9 * * *"), Date.UTC(2026, 5, 21, 0, 0), 1, "UTC");
    expect(formatRun(runs[0]!)).toBe("2026-06-21 09:00 Sun");
  });
});

describe("formatDelta", () => {
  const m = 60_000;
  const h = 60 * m;
  const d = 24 * h;

  it("reports anything below one minute as <1m", () => {
    expect(formatDelta(0)).toBe("in <1m");
    expect(formatDelta(59_999)).toBe("in <1m");
  });

  it("uses minutes below one hour", () => {
    expect(formatDelta(m)).toBe("in 1m");
    expect(formatDelta(45 * m)).toBe("in 45m");
  });

  it("uses hours and minutes below one day", () => {
    expect(formatDelta(2 * h + 14 * m)).toBe("in 2h 14m");
    expect(formatDelta(3 * h)).toBe("in 3h");
    expect(formatDelta(23 * h + 59 * m + 59_000)).toBe("in 23h 59m");
  });

  it("uses days and hours from one day up", () => {
    expect(formatDelta(3 * d + 4 * h)).toBe("in 3d 4h");
    expect(formatDelta(2 * d)).toBe("in 2d");
    expect(formatDelta(d + 30 * m)).toBe("in 1d");
  });
});

describe("renderMarkdown / renderJson", () => {
  const spec = parseCron("*/30 * * * *");
  const fromMs = Date.UTC(2026, 5, 22, 8, 5);
  const runs = nextRuns(spec, fromMs, 2, "UTC");

  it("renders a Markdown digest", () => {
    const md = renderMarkdown("*/30 * * * *", spec, "UTC", runs, 2, fromMs);
    expect(md).toContain("# cron: */30 * * * *");
    expect(md).toContain("Timezone: UTC");
    expect(md).toContain("## Next 2 runs");
    expect(md).toContain("1. 2026-06-22 08:30");
  });

  it("annotates each run with a relative delta from the reference time", () => {
    const md = renderMarkdown("*/30 * * * *", spec, "UTC", runs, 2, fromMs);
    expect(md).toContain("1. 2026-06-22 08:30 Mon (in 25m)");
    expect(md).toContain("2. 2026-06-22 09:00 Mon (in 55m)");
  });

  it("keeps JSON output free of relative-time annotations", () => {
    const parsed = JSON.parse(renderJson("*/30 * * * *", spec, "UTC", runs));
    expect(parsed.next[0].local).toBe("2026-06-22 08:30 Mon");
  });

  it("renders JSON with iso instants", () => {
    const parsed = JSON.parse(renderJson("*/30 * * * *", spec, "UTC", runs));
    expect(parsed.expression).toBe("*/30 * * * *");
    expect(parsed.next[0].iso).toBe("2026-06-22T08:30:00.000Z");
    expect(parsed.next[0].local).toContain("2026-06-22 08:30");
  });
});
