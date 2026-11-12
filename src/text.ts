/**
 * Plain English or Japanese schedule phrases to a cron expression: "every
 * weekday at 9:30", "every 15 minutes", "毎週月曜と木曜 10時", "毎月1日 午前9時".
 * A small grammar, not natural-language understanding: a phrase it does not
 * know is an error, never a guess.
 */

const EN_DAYS: Record<string, number> = {
  sunday: 0, sun: 0, monday: 1, mon: 1, tuesday: 2, tue: 2, tues: 2, wednesday: 3, wed: 3,
  thursday: 4, thu: 4, thur: 4, thurs: 4, friday: 5, fri: 5, saturday: 6, sat: 6,
};
const JA_DAYS: Record<string, number> = { 日: 0, 月: 1, 火: 2, 水: 3, 木: 4, 金: 5, 土: 6 };

interface Time {
  hour: number;
  minute: number;
}

/** "9", "9:30", "9am", "9:30 pm", "21:00", "noon", "midnight", "午後3時", "9時半", "10時15分". */
function parseTime(s: string): Time | undefined {
  const t = s.trim();
  if (t === "noon" || t === "正午") return { hour: 12, minute: 0 };
  if (t === "midnight") return { hour: 0, minute: 0 };
  let m = /^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/.exec(t);
  if (m) {
    let hour = Number(m[1]);
    const minute = m[2] ? Number(m[2]) : 0;
    if (m[3]) {
      if (hour < 1 || hour > 12) return undefined;
      hour = (hour % 12) + (m[3] === "pm" ? 12 : 0);
    }
    return hour <= 23 && minute <= 59 ? { hour, minute } : undefined;
  }
  m = /^(午前|午後)?(\d{1,2})時(?:(\d{1,2})分|(半))?$/.exec(t);
  if (m) {
    let hour = Number(m[2]);
    const minute = m[4] ? 30 : m[3] ? Number(m[3]) : 0;
    if (m[1]) {
      if (hour > 12) return undefined;
      hour = (hour % 12) + (m[1] === "午後" ? 12 : 0);
    }
    return hour <= 23 && minute <= 59 ? { hour, minute } : undefined;
  }
  return undefined;
}

function times(list: string): Time[] | undefined {
  const parts = list.split(/\s*(?:,|and|と|、|・)\s*/).filter((p) => p !== "");
  const out = parts.map(parseTime);
  return out.length > 0 && out.every((t) => t !== undefined) ? (out as Time[]) : undefined;
}

/** Times sharing one minute become one cron line; anything else is refused. */
function timeFields(ts: Time[]): string {
  const minute = (ts[0] as Time).minute;
  if (ts.some((t) => t.minute !== minute)) {
    throw new Error("times with different minutes need separate cron lines (e.g. 9:00 and 9:30)");
  }
  return `${minute} ${[...new Set(ts.map((t) => t.hour))].sort((a, b) => a - b).join(",")}`;
}

function every(n: number, unit: "minute" | "hour"): string {
  const limit = unit === "minute" ? 59 : 23;
  if (!Number.isInteger(n) || n < 1 || n > limit) throw new Error(`every ${n} ${unit}s is out of range`);
  if (n === 1) return unit === "minute" ? "* * * * *" : "0 * * * *";
  return unit === "minute" ? `*/${n} * * * *` : `0 */${n} * * *`;
}

function dayOfMonth(n: number): string {
  if (!Number.isInteger(n) || n < 1 || n > 31) throw new Error(`day ${n} of the month is out of range`);
  return String(n);
}

/** Convert a schedule phrase to a 5-field cron expression. */
export function cronFromText(input: string): string {
  const s = input.normalize("NFKC").trim().toLowerCase().replace(/\s+/g, " ");
  let m: RegExpExecArray | null;

  // Intervals.
  if (/^(every minute|毎分)$/.test(s)) return every(1, "minute");
  if ((m = /^every (\d+) minutes?$/.exec(s)) || (m = /^(\d+) ?分(?:ごと|毎|おき)(?:に)?$/.exec(s))) {
    return every(Number(m[1]), "minute");
  }
  if (/^(every hour|hourly|毎時|1時間(?:ごと|毎|おき))$/.test(s)) return every(1, "hour");
  if ((m = /^every hour at (?::|minute )?(\d{1,2})$/.exec(s)) || (m = /^毎時 ?(\d{1,2})分$/.exec(s))) {
    const minute = Number(m[1]);
    if (minute > 59) throw new Error(`minute ${minute} is out of range`);
    return `${minute} * * * *`;
  }
  if ((m = /^every (\d+) hours?$/.exec(s)) || (m = /^(\d+) ?時間(?:ごと|毎|おき)(?:に)?$/.exec(s))) {
    return every(Number(m[1]), "hour");
  }

  // Day part, then "at <times>" (English) or the times (Japanese).
  const en = /^(?:every |each )?(day|daily|weekday|weekdays|weekend|weekends|[a-z, ]+?)(?: (?:at|@) (.+))?$/.exec(s);
  const monthEn = /^(?:every month |monthly )?on (?:the |day )?(\d{1,2})(?:st|nd|rd|th)?(?: of (?:every|each) month)?(?: (?:at|@) (.+))?$/.exec(s);
  if (monthEn) {
    const t = monthEn[2] ? times(monthEn[2]) : [{ hour: 0, minute: 0 }];
    if (!t) throw new Error(`cannot read the time in "${input}"`);
    return `${timeFields(t)} ${dayOfMonth(Number(monthEn[1]))} * *`;
  }
  const ja = /^(毎日|平日|土日|週末|毎週([月火水木金土日曜と、・,]+)|毎月 ?(\d{1,2})日)(?: ?(.+))?$/.exec(s);
  if (ja) {
    const t = ja[4] ? times(ja[4]) : [{ hour: 0, minute: 0 }];
    if (!t) throw new Error(`cannot read the time in "${input}"`);
    const tf = timeFields(t);
    if (ja[1] === "毎日") return `${tf} * * *`;
    if (ja[1] === "平日") return `${tf} * * 1-5`;
    if (ja[1] === "土日" || ja[1] === "週末") return `${tf} * * 0,6`;
    if (ja[3]) return `${tf} ${dayOfMonth(Number(ja[3]))} * *`;
    const days = (ja[2] as string)
      .split(/曜日?|と|、|・|,/)
      .filter((d) => d !== "")
      .map((d) => JA_DAYS[d]);
    if (days.length === 0 || days.some((d) => d === undefined)) throw new Error(`cannot read the weekdays in "${input}"`);
    return `${tf} * * ${[...new Set(days as number[])].sort((a, b) => a - b).join(",")}`;
  }
  if (en) {
    const t = en[2] ? times(en[2]) : [{ hour: 0, minute: 0 }];
    if (!t) throw new Error(`cannot read the time in "${input}"`);
    const tf = timeFields(t);
    const day = en[1] as string;
    if (day === "day" || day === "daily") return `${tf} * * *`;
    if (day === "weekday" || day === "weekdays") return `${tf} * * 1-5`;
    if (day === "weekend" || day === "weekends") return `${tf} * * 0,6`;
    const names = day.split(/\s*(?:,|and)\s*/).filter((d) => d !== "").map((d) => d.replace(/s$/, ""));
    const days = names.map((d) => EN_DAYS[d] ?? EN_DAYS[`${d}s`]);
    if (days.length > 0 && days.every((d) => d !== undefined)) {
      return `${tf} * * ${[...new Set(days as number[])].sort((a, b) => a - b).join(",")}`;
    }
  }
  throw new Error(
    `cannot turn "${input}" into a schedule; try e.g. "every 15 minutes", "every weekday at 9:30", "every monday and thursday at 10am", "on the 1st at 9:00", "毎日 9時", "平日 午後6時半", "毎週月曜と木曜 10時", "毎月1日 9時"`,
  );
}
