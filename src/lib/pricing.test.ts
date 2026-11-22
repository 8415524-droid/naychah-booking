import { describe, expect, it } from "vitest";
import { classify, quote, depositFor, dowOf, type PricingRule, type AptTiming } from "./pricing";

const apt: AptTiming = {
  early_cutoff_dow: 4, early_cutoff_time: "12:00:00",
  single_night_opens_dow: 4, single_night_opens_time: "18:00:00",
};
const rules: PricingRule[] = [
  { period_type: "thu_sat", valid_from: null, valid_to: null, price_early: 1500, price_late: 1800 },
  { period_type: "fri_sat", valid_from: null, valid_to: null, price_early: 900, price_late: 1000 },
  { period_type: "single_night", valid_from: null, valid_to: null, price_early: 800, price_late: 800 },
  { period_type: "midweek", valid_from: null, valid_to: null, price_early: 300, price_late: 300 },
  { period_type: "special", valid_from: "2027-05-22", valid_to: "2027-05-24", price_early: 2000, price_late: 2500 },
];
// 2026-12-03 הוא יום חמישי
const THU = "2026-12-03", FRI = "2026-12-04", SAT = "2026-12-05", SUN = "2026-12-06";

describe("pricing", () => {
  it("בודק שהתאריך הוא חמישי", () => expect(dowOf(THU)).toBe(4));
  it("מסווג תקופות", () => {
    expect(classify(THU, SAT)).toBe("thu_sat");
    expect(classify(FRI, SAT)).toBe("fri_sat");
    expect(classify(THU, FRI)).toBe("single_night");
    expect(classify("2026-11-30", "2026-12-02")).toBe("midweek");
    expect(classify(THU, SUN)).toBeNull();
  });
  it("מחיר מוזל עד שעת הסף ורגיל אחריה", () => {
    const early = quote(THU, SAT, apt, rules, "2026-12-03T11:59");
    const late = quote(THU, SAT, apt, rules, "2026-12-03T12:01");
    expect(early).toMatchObject({ ok: true, total: 1500, early: true });
    expect(late).toMatchObject({ ok: true, total: 1800, early: false });
  });
  it("שישי בלבד אחרי חמישי בצהריים הוא מחיר רגיל", () => {
    expect(quote(FRI, SAT, apt, rules, "2026-12-04T09:00")).toMatchObject({ total: 1000, early: false });
  });
  it("מחיר מוזל שבועות מראש", () => {
    expect(quote(THU, SAT, apt, rules, "2026-11-10T10:00")).toMatchObject({ total: 1500, early: true });
  });
  it("לילה בודד נחסם עד השעה שנקבעה ונפתח אחריה", () => {
    const before = quote(THU, FRI, apt, rules, "2026-12-03T17:00");
    expect(before.ok).toBe(false);
    expect(quote(THU, FRI, apt, rules, "2026-12-03T18:00")).toMatchObject({ ok: true, total: 800 });
  });
  it("לילה בודד שבועות מראש חסום", () => {
    expect(quote(THU, FRI, apt, rules, "2026-11-10T10:00").ok).toBe(false);
  });
  it("אמצע שבוע מתומחר ללילה", () => {
    expect(quote("2026-11-30", "2026-12-02", apt, rules, "2026-11-20T10:00")).toMatchObject({ total: 600 });
  });
  it("תקופה מיוחדת גוברת ומתומחרת ללילה", () => {
    // 2027-05-21 יום שישי, כניסה בשישי ללילה אחד בתוך הטווח? הטווח מתחיל ב-22.
    expect(quote("2027-05-22", "2027-05-24", apt, rules, "2027-05-01T10:00")).toMatchObject({ period: "special", total: 4000 });
  });
  it("בלי מחיר מוגדר מחזיר שגיאה", () => {
    expect(quote(THU, SAT, apt, [], "2026-12-01T10:00").ok).toBe(false);
  });
  it("מקדמה 12% מעוגלת למעלה", () => {
    expect(depositFor(1000)).toBe(120);
    expect(depositFor(1501)).toBe(181);
  });
});
