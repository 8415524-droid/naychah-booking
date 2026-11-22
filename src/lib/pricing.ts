// מנוע מחירים: טהור, בלי תלות במסד. כל התאריכים כמחרוזות YYYY-MM-DD,
// והשעה הנוכחית כזמן מקומי (ישראל) כמחרוזת "YYYY-MM-DDTHH:MM".

export type PeriodType = "thu_sat" | "fri_sat" | "single_night" | "midweek" | "special";

export interface PricingRule {
  period_type: PeriodType;
  valid_from: string | null;
  valid_to: string | null; // כולל
  price_early: number;
  price_late: number;
}

export interface AptTiming {
  early_cutoff_dow: number;
  early_cutoff_time: string; // HH:MM או HH:MM:SS
  single_night_opens_dow: number;
  single_night_opens_time: string;
}

export type Quote =
  | { ok: true; total: number; period: PeriodType; early: boolean; nights: number }
  | { ok: false; reason: string };

const DOW_HE = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];
const DAY = 86400000;

const toMs = (d: string) => Date.parse(d + "T00:00:00Z");
const toStr = (ms: number) => new Date(ms).toISOString().slice(0, 10);

export const dowOf = (d: string) => new Date(toMs(d)).getUTCDay();
export const addDays = (d: string, n: number) => toStr(toMs(d) + n * DAY);
export const nightsBetween = (a: string, b: string) => Math.round((toMs(b) - toMs(a)) / DAY);

/** התאריך האחרון שלא אחרי d ביום השבוע dow. */
export function latestOnOrBefore(d: string, dow: number) {
  const diff = (dowOf(d) - dow + 7) % 7;
  return addDays(d, -diff);
}

const hhmm = (t: string) => t.slice(0, 5);

export function cutoffMoment(checkIn: string, dow: number, time: string) {
  return `${latestOnOrBefore(checkIn, dow)}T${hhmm(time)}`;
}

export function classify(checkIn: string, checkOut: string): PeriodType | null {
  const n = nightsBetween(checkIn, checkOut);
  const dow = dowOf(checkIn);
  if (n === 2 && dow === 4) return "thu_sat";
  if (n === 1 && dow === 5) return "fri_sat";
  if (n === 1 && dow === 4) return "single_night";
  if (n >= 1 && dow <= 3 && dowOf(addDays(checkOut, -1)) <= 3 && dow + n - 1 <= 3) return "midweek";
  return null;
}

export function quote(
  checkIn: string,
  checkOut: string,
  apt: AptTiming,
  rules: PricingRule[],
  nowLocal: string,
): Quote {
  const nights = nightsBetween(checkIn, checkOut);
  if (nights < 1) return { ok: false, reason: "תאריכים לא תקינים" };

  const isEarly = nowLocal <= cutoffMoment(checkIn, apt.early_cutoff_dow, apt.early_cutoff_time);
  const pick = (r: PricingRule) => (isEarly ? r.price_early : r.price_late);

  // תקופה מיוחדת (חג, ל"ג בעומר) גוברת. המחיר שלה ללילה.
  const lastNight = addDays(checkOut, -1);
  const special = rules.find(
    (r) => r.period_type === "special" && r.valid_from && r.valid_to && r.valid_from <= lastNight && r.valid_to >= checkIn,
  );
  if (special) return { ok: true, total: pick(special) * nights, period: "special", early: isEarly, nights };

  const period = classify(checkIn, checkOut);
  if (!period) return { ok: false, reason: "סוג שהייה שאינו מוגדר במחירון" };

  if (period === "single_night") {
    const opens = cutoffMoment(checkIn, apt.single_night_opens_dow, apt.single_night_opens_time);
    if (nowLocal < opens) {
      return {
        ok: false,
        reason: `לילה בודד נפתח ביום ${DOW_HE[apt.single_night_opens_dow]} בשעה ${hhmm(apt.single_night_opens_time)}`,
      };
    }
  }

  const rule = rules.find((r) => r.period_type === period);
  if (!rule) return { ok: false, reason: "לא הוגדר מחיר לסוג שהייה זה" };
  // אמצע שבוע מתומחר ללילה, שאר הסוגים למחיר שהייה מלא.
  const total = period === "midweek" ? pick(rule) * nights : pick(rule);
  return { ok: true, total, period, early: isEarly, nights };
}

export function depositFor(total: number, percent = 12) {
  return Math.ceil((total * percent) / 100);
}

/** השעה הנוכחית בישראל כמחרוזת "YYYY-MM-DDTHH:MM". */
export function nowInJerusalem(d = new Date()) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Jerusalem", year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", hourCycle: "h23",
    }).formatToParts(d).map((x) => [x.type, x.value]),
  );
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}
