import { describe, expect, it } from "vitest";
import { parseCron } from "../src/parse.js";
import { nextRuns } from "../src/schedule.js";
import { describeSpec } from "../src/describe.js";
import { renderMarkdown, renderJson, formatRun } from "../src/render.js";

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

describe("renderMarkdown / renderJson", () => {
  const spec = parseCron("*/30 * * * *");
  const runs = nextRuns(spec, Date.UTC(2026, 5, 22, 8, 5), 2, "UTC");

  it("renders a Markdown digest", () => {
    const md = renderMarkdown("*/30 * * * *", spec, "UTC", runs, 2);
    expect(md).toContain("# cron: */30 * * * *");
    expect(md).toContain("Timezone: UTC");
    expect(md).toContain("## Next 2 runs");
    expect(md).toContain("1. 2026-06-22 08:30");
  });

  it("renders JSON with iso instants", () => {
    const parsed = JSON.parse(renderJson("*/30 * * * *", spec, "UTC", runs));
    expect(parsed.expression).toBe("*/30 * * * *");
    expect(parsed.next[0].iso).toBe("2026-06-22T08:30:00.000Z");
    expect(parsed.next[0].local).toContain("2026-06-22 08:30");
  });
});
