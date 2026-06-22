import { describe, expect, it } from "vitest";
import { parseCron } from "../src/parse.js";
import { nextRuns } from "../src/schedule.js";

const utc = (y: number, mo: number, d: number, h = 0, mi = 0): number => Date.UTC(y, mo - 1, d, h, mi);

describe("nextRuns (UTC)", () => {
  it("steps every 15 minutes, strictly after the start", () => {
    const runs = nextRuns(parseCron("*/15 * * * *"), utc(2026, 6, 22, 9, 7), 3, "UTC");
    expect(runs.map((r) => r.ms)).toEqual([utc(2026, 6, 22, 9, 15), utc(2026, 6, 22, 9, 30), utc(2026, 6, 22, 9, 45)]);
  });

  it("skips to the next weekday for a weekday-only schedule", () => {
    // 2026-06-20 is a Saturday; next 09:00 on Mon-Fri is Monday the 22nd.
    const runs = nextRuns(parseCron("0 9 * * 1-5"), utc(2026, 6, 20, 12, 0), 1, "UTC");
    expect(runs[0]?.ms).toBe(utc(2026, 6, 22, 9, 0));
  });

  it("honors the day-of-month OR day-of-week rule", () => {
    // From Mon 06-22 00:01: next "1st OR Monday" at 00:00 is Monday 06-29.
    const runs = nextRuns(parseCron("0 0 1 * MON"), utc(2026, 6, 22, 0, 1), 2, "UTC");
    expect(runs[0]?.ms).toBe(utc(2026, 6, 29, 0, 0)); // Monday
    expect(runs[1]?.ms).toBe(utc(2026, 7, 1, 0, 0)); // the 1st
  });

  it("finds the next leap day for Feb 29", () => {
    const runs = nextRuns(parseCron("0 0 29 2 *"), utc(2026, 1, 1), 1, "UTC");
    expect(runs[0]).toMatchObject({ year: 2028, month: 2, day: 29 });
  });

  it("returns nothing for an impossible date", () => {
    expect(nextRuns(parseCron("0 0 30 2 *"), utc(2026, 1, 1), 5, "UTC")).toEqual([]);
  });
});

describe("nextRuns (timezone)", () => {
  it("anchors wall-clock runs to the right instant", () => {
    // 09:00 Asia/Tokyo == 00:00 UTC. From 09:00 JST on 06-22, next is 06-23.
    const runs = nextRuns(parseCron("0 9 * * *"), utc(2026, 6, 22, 0, 0), 1, "Asia/Tokyo");
    expect(runs[0]?.ms).toBe(utc(2026, 6, 23, 0, 0));
    expect(runs[0]).toMatchObject({ year: 2026, month: 6, day: 23, hour: 9, minute: 0 });
  });
});
