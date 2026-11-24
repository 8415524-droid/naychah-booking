import { describe, expect, it } from "vitest";
import { buildAlerts } from "./alerts";
import { forecastWeekend } from "./forecast";
import { customerMessages, waNumber } from "./messages";
import { toCsv } from "./csv";

const b = (o: object) => ({ id: "1", apartment: "הגפן", customer: "דוד", status: "hold", check_in: "2026-12-04", check_out: "2026-12-06", deposit_required: 180, paid: 0, hold_expires_at: null, ...o });
const apt = { id: "a", name: "הגפן", hasPricing: true, hasOwnerPhone: true, calendarSynced: true };

describe("התראות", () => {
  it("תפיסה שעומדת לפוג היא דחופה", () => {
    const now = Date.parse("2026-12-01T10:00:00Z");
    const a = buildAlerts([b({ hold_expires_at: "2026-12-01T10:05:00Z" })], [apt], "2026-12-01", now);
    expect(a[0].sev).toBe("bad");
  });
  it("תפיסה שפגה לא מופיעה", () => {
    const now = Date.parse("2026-12-01T10:00:00Z");
    expect(buildAlerts([b({ hold_expires_at: "2026-12-01T09:00:00Z" })], [apt], "2026-12-01", now)).toHaveLength(0);
  });
  it("כניסה מחר ומקדמה חסרה", () => {
    const a = buildAlerts([b({ status: "confirmed", check_in: "2026-12-02", paid: 50 })], [apt], "2026-12-01", 0);
    expect(a.map((x) => x.sev)).toEqual(["bad", "warn"]);
  });
  it("דירה בלי מחירון", () => {
    expect(buildAlerts([], [{ ...apt, hasPricing: false }], "2026-12-01", 0)[0].text).toContain("מחירון");
  });
});

describe("תחזית שבת", () => {
  const apts = [{ id: "a", name: "א" }, { id: "b", name: "ב" }, { id: "c", name: "ג" }, { id: "d", name: "ד" }];
  it("סופר סגורה, ממתינה, חסומה ופנויה", () => {
    const r = forecastWeekend("2026-12-05", "וישלח", apts, [
      { apartment_id: "a", check_in: "2026-12-04", check_out: "2026-12-06", status: "confirmed", total_price: 2000, deposit_required: 240 },
      { apartment_id: "b", check_in: "2026-12-04", check_out: "2026-12-06", status: "hold", total_price: 1000, deposit_required: 120 },
    ], [{ apartment_id: "c", date_from: "2026-12-04", date_to: "2026-12-06" }]);
    expect([r.booked, r.held, r.blocked, r.free]).toEqual([1, 1, 1, 1]);
    expect(r.occupancyPct).toBe(50);
    expect(r.revenue).toBe(2000);
    expect(r.deposits).toBe(240);
    expect(r.freeNames).toEqual(["ד"]);
  });
});

describe("הודעות", () => {
  it("מספר לוואטסאפ", () => { expect(waNumber("050-123-4567")).toBe("972501234567"); expect(waNumber("+972 50 1234567")).toBe("972501234567"); });
  it("בקשת מקדמה משתמשת באחוז מההגדרות", () => {
    const m = customerMessages({ customer: "דוד", apartment: "הגפן", check_in: "2026-12-04", check_out: "2026-12-06", guests: 5, total_price: 2000, deposit_required: 240, paid: 0 }, 12);
    expect(m[0].text).toContain("12%");
    expect(m[0].text).not.toContain("30%");
  });
});

describe("CSV", () => {
  it("מוסיף BOM, מצטט ומנטרל נוסחאות", () => {
    const c = toCsv([{ a: 'x"y', b: "=1+1" }]);
    expect(c.startsWith("﻿")).toBe(true);
    expect(c).toContain('"x""y"');
    expect(c).toContain(`"'=1+1"`);
  });
});
