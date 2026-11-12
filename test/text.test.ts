import { describe, expect, it } from "vitest";
import { cronFromText } from "../src/text.js";

describe("cronFromText", () => {
  const cases: [string, string][] = [
    ["every minute", "* * * * *"],
    ["every 15 minutes", "*/15 * * * *"],
    ["Every hour", "0 * * * *"],
    ["every hour at :20", "20 * * * *"],
    ["every 6 hours", "0 */6 * * *"],
    ["daily", "0 0 * * *"],
    ["every day at 7am", "0 7 * * *"],
    ["every day at 9 and 18", "0 9,18 * * *"],
    ["every weekday at 9:30", "30 9 * * 1-5"],
    ["weekends at noon", "0 12 * * 0,6"],
    ["every Monday and Thursday at 10am", "0 10 * * 1,4"],
    ["every fri at 5:45 pm", "45 17 * * 5"],
    ["on the 1st at 9:00", "0 9 1 * *"],
    ["monthly on day 15 at midnight", "0 0 15 * *"],
    ["毎分", "* * * * *"],
    ["5分ごと", "*/5 * * * *"],
    ["毎時", "0 * * * *"],
    ["毎時30分", "30 * * * *"],
    ["3時間おき", "0 */3 * * *"],
    ["毎日 9時", "0 9 * * *"],
    ["毎日9時半", "30 9 * * *"],
    ["平日 午後6時", "0 18 * * 1-5"],
    ["土日 10時", "0 10 * * 0,6"],
    ["毎週月曜と木曜 10時", "0 10 * * 1,4"],
    ["毎週金曜日 17:30", "30 17 * * 5"],
    ["毎月1日 午前9時", "0 9 1 * *"],
    ["毎日 9時、18時", "0 9,18 * * *"],
  ];
  for (const [text, cron] of cases) {
    it(`${text} -> ${cron}`, () => {
      expect(cronFromText(text)).toBe(cron);
    });
  }

  it("refuses what it cannot read instead of guessing", () => {
    for (const bad of ["tomorrow", "every 0 minutes", "every 90 minutes", "every day at 25:00", "毎月32日", "every day at 9:00 and 9:30", "毎週祝日 9時"]) {
      expect(() => cronFromText(bad), bad).toThrow();
    }
  });
});
