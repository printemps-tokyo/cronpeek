import { describe, expect, it } from "vitest";
import { daysInMonth, weekday, dayMatches } from "../src/match.js";
import { parseCron } from "../src/parse.js";

describe("calendar helpers", () => {
  it("daysInMonth handles leap years", () => {
    expect(daysInMonth(2024, 2)).toBe(29);
    expect(daysInMonth(2026, 2)).toBe(28);
    expect(daysInMonth(2026, 4)).toBe(30);
  });

  it("weekday is 0=Sunday", () => {
    expect(weekday(2026, 6, 19)).toBe(5); // Friday
    expect(weekday(2026, 6, 22)).toBe(1); // Monday
    expect(weekday(2026, 6, 21)).toBe(0); // Sunday
  });
});

describe("dayMatches", () => {
  it("uses OR when both day-of-month and day-of-week are restricted", () => {
    const spec = parseCron("0 0 1 * MON"); // 1st OR Monday
    expect(dayMatches(spec, 2026, 7, 1)).toBe(true); // the 1st (a Wednesday)
    expect(dayMatches(spec, 2026, 6, 22)).toBe(true); // a Monday
    expect(dayMatches(spec, 2026, 6, 23)).toBe(false); // neither
  });

  it("uses only the restricted field otherwise", () => {
    const domOnly = parseCron("0 0 15 * *");
    expect(dayMatches(domOnly, 2026, 6, 15)).toBe(true);
    expect(dayMatches(domOnly, 2026, 6, 22)).toBe(false); // a Monday, but dow is *

    const dowOnly = parseCron("0 0 * * MON");
    expect(dayMatches(dowOnly, 2026, 6, 22)).toBe(true); // Monday
    expect(dayMatches(dowOnly, 2026, 6, 2)).toBe(false); // Tuesday
  });
});
