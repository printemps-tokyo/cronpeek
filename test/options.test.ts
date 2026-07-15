import { describe, expect, it } from "vitest";
import { resolveFormat } from "../src/options.js";

describe("resolveFormat", () => {
  it("defaults to md when neither flag is given", () => {
    expect(resolveFormat(undefined, false)).toBe("md");
  });

  it("honors --format md and --format json", () => {
    expect(resolveFormat("md", false)).toBe("md");
    expect(resolveFormat("json", false)).toBe("json");
  });

  it("treats --json as shorthand for --format json", () => {
    expect(resolveFormat(undefined, true)).toBe("json");
  });

  it("accepts --json together with an agreeing --format json", () => {
    expect(resolveFormat("json", true)).toBe("json");
  });

  it("rejects --json combined with --format md", () => {
    expect(() => resolveFormat("md", true)).toThrow("--json conflicts with --format md");
  });

  it("rejects unknown --format values", () => {
    expect(() => resolveFormat("yaml", false)).toThrow("--format must be md or json");
  });
});
