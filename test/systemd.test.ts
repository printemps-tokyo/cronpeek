import { describe, expect, it } from "vitest";
import { parseCron } from "../src/parse.js";
import { toSystemdCalendar } from "../src/systemd.js";
import { shortestGapMinutes, workflowSchedules } from "../src/workflow.js";

const sd = (cron: string, tz?: string) => toSystemdCalendar(parseCron(cron), tz);

describe("toSystemdCalendar", () => {
  it("writes lists and ranges of the matched values", () => {
    expect(sd("*/15 9-18 * * 1-5")).toEqual(["Mon..Fri *-*-* 09..18:00,15,30,45:00"]);
    expect(sd("0 0 * * *")).toEqual(["*-*-* 00:00:00"]);
    expect(sd("* * * * *")).toEqual(["*-*-* *:*:00"]);
    expect(sd("30 2 1 1,4,7,10 *", "UTC")).toEqual(["*-01,04,07,10-01 02:30:00 UTC"]);
  });

  it("puts Sunday last, as systemd counts from Monday", () => {
    expect(sd("0 9 * * 0,6")).toEqual(["Sat..Sun *-*-* 09:00:00".replace("Sat..Sun", "Sat,Sun")]);
    expect(sd("0 9 * * 5-7")).toEqual(["Fri..Sun *-*-* 09:00:00"]);
  });

  it("splits a day-of-month OR weekday schedule into two events", () => {
    expect(sd("0 9 1,15 * 1", "Asia/Tokyo")).toEqual([
      "*-*-01,15 09:00:00 Asia/Tokyo",
      "Mon *-*-* 09:00:00 Asia/Tokyo",
    ]);
  });
});

describe("workflowSchedules", () => {
  it("reads each cron with its entry's timezone", () => {
    const yaml = [
      "on:",
      "  schedule:",
      "    - cron: '30 5 * * 1-5'",
      '      timezone: "America/New_York"',
      '    - cron: "0 0 * * *"  # nightly',
      "    - timezone: Asia/Tokyo",
      "      cron: 15 9 * * *",
      "  workflow_dispatch:",
      "jobs: {}",
    ].join("\n");
    expect(workflowSchedules(yaml)).toEqual([
      { line: 3, cron: "30 5 * * 1-5", timeZone: "America/New_York" },
      { line: 5, cron: "0 0 * * *" },
      { line: 7, cron: "15 9 * * *", timeZone: "Asia/Tokyo" },
    ]);
  });

  it("measures the shortest gap between runs", () => {
    expect(shortestGapMinutes([0, 120_000, 600_000])).toBe(2);
    expect(shortestGapMinutes([0])).toBeUndefined();
  });
});
