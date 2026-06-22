import { describe, expect, it } from "vitest";
import { parseCron, parseField } from "../src/parse.js";

const sorted = (s: Set<number>): number[] => [...s].sort((a, b) => a - b);

describe("parseField", () => {
  const minute = { min: 0, max: 59, label: "minute" };

  it("expands *, steps, ranges, and lists", () => {
    expect(sorted(parseField("*/15", minute).set)).toEqual([0, 15, 30, 45]);
    expect(sorted(parseField("1-5", minute).set)).toEqual([1, 2, 3, 4, 5]);
    expect(sorted(parseField("0,30", minute).set)).toEqual([0, 30]);
    expect(sorted(parseField("10-20/5", minute).set)).toEqual([10, 15, 20]);
  });

  it("flags restricted vs unrestricted", () => {
    expect(parseField("*", minute).restricted).toBe(false);
    expect(parseField("5", minute).restricted).toBe(true);
  });

  it("rejects out-of-range and malformed terms", () => {
    expect(() => parseField("60", minute).set).toThrow();
    expect(() => parseField("5-1", minute).set).toThrow();
    expect(() => parseField("*/0", minute).set).toThrow();
    expect(() => parseField("a", minute).set).toThrow();
  });
});

describe("parseCron", () => {
  it("parses month and weekday names and normalizes 7 to Sunday", () => {
    const spec = parseCron("0 0 * JAN-MAR MON,SUN");
    expect(sorted(spec.months)).toEqual([1, 2, 3]);
    expect(sorted(spec.dows)).toEqual([0, 1]);
    expect(sorted(parseCron("0 0 * * 7").dows)).toEqual([0]);
  });

  it("expands @aliases", () => {
    const daily = parseCron("@daily");
    expect(sorted(daily.minutes)).toEqual([0]);
    expect(sorted(daily.hours)).toEqual([0]);
    expect(daily.domRestricted).toBe(false);
  });

  it("tracks dom/dow restriction independently", () => {
    const spec = parseCron("0 0 1 * 1");
    expect(spec.domRestricted).toBe(true);
    expect(spec.dowRestricted).toBe(true);
  });

  it("rejects bad input", () => {
    expect(() => parseCron("* * * *")).toThrow(); // 4 fields
    expect(() => parseCron("@reboot")).toThrow();
    expect(() => parseCron("@nope")).toThrow();
    expect(() => parseCron("")).toThrow();
  });
});
