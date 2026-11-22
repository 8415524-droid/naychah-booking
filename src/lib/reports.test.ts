import { describe, expect, it } from "vitest";
import { monthRange, nightsInRange, summarize } from "./reports";

describe("דוחות", () => {
  it("טווח חודש", () => expect(monthRange("2026-12")).toEqual({ from: "2026-12-01", to: "2027-01-01" }));
  it("לילות בטווח חותכים הזמנה שחוצה חודש", () => {
    expect(nightsInRange({ check_in: "2026-11-29", check_out: "2026-12-02" }, "2026-12-01", "2027-01-01")).toBe(1);
    expect(nightsInRange({ check_in: "2027-02-01", check_out: "2027-02-03" }, "2026-12-01", "2027-01-01")).toBe(0);
  });
  it("סיכום לפי דירה ובעלים, רק הזמנות סגורות", () => {
    const apts = [{ id: "a", name: "הגפן", owner_id: "o", owner_name: "משה" }];
    const s = summarize(apts, [
      { apartment_id: "a", check_in: "2026-12-03", check_out: "2026-12-05", status: "confirmed", total_price: 1500 },
      { apartment_id: "a", check_in: "2026-12-10", check_out: "2026-12-12", status: "hold", total_price: 999 },
      { apartment_id: "a", check_in: "2026-12-17", check_out: "2026-12-19", status: "cancelled", total_price: 999 },
    ], "2026-12-01", "2027-01-01");
    expect(s.rows[0]).toMatchObject({ nights: 2, revenue: 1500 });
    expect(s.rows[0].occupancy).toBe(6); // 2 מתוך 31
    expect(s.owners).toEqual([{ owner: "משה", nights: 2, revenue: 1500 }]);
  });
  it("הכנסה של הזמנה חוצה חודש מחולקת", () => {
    const apts = [{ id: "a", name: "א", owner_id: "o", owner_name: "ב" }];
    const s = summarize(apts, [{ apartment_id: "a", check_in: "2026-11-30", check_out: "2026-12-02", status: "confirmed", total_price: 1000 }], "2026-12-01", "2027-01-01");
    expect(s.totalRevenue).toBe(500);
  });
});
