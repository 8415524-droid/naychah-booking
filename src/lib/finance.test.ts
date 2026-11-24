import { describe, expect, it } from "vitest";
import { DEFAULT_FIN, employeeCost, invoiceLines, plSummary, settlement, vatSplit } from "./finance";

const b = (o: object) => ({ apartment_id: "a", apartment: "הגפן", owner_id: "o", owner: "משה", check_in: "2026-12-04", status: "confirmed", total_price: 2000, deposit_required: 240, ...o });

describe("כספים", () => {
  it("מע״מ כלול ולא כלול", () => {
    expect(vatSplit(118, 18, true).net).toBeCloseTo(100);
    expect(vatSplit(100, 18, false)).toEqual({ net: 100, vat: 0 });
  });
  it("עלות עובד שעתי וחודשי", () => {
    expect(employeeCost({ pay_kind: "hourly", rate: 50 }, 10, 100, 22).gross).toBe(600);
    expect(employeeCost({ pay_kind: "monthly", rate: 1000 }, 0, 0, 20).cost).toBe(1200);
  });
  it("רווח והפסד: הכנסה = מקדמות, הוצאות ושכר מופחתים", () => {
    const r = plSummary("2026-12", [b({}), b({ status: "cancelled" }), b({ check_in: "2027-01-02" })],
      [{ spent_on: "2026-12-05", category: "משרד ושכירות", amount: 118, includes_vat: true }],
      [{ month: "2026-12", category: "ניקיון", amount: 50, apartment_id: "a" }, { month: "2026-12", category: "חשבונות נכס", amount: 70, charge_owner: true }], 40, DEFAULT_FIN);
    expect(r.rev).toBe(240); expect(r.expNet).toBeCloseTo(150); expect(r.profit).toBeCloseTo(50);
    expect(r.perHouse[0].cost).toBe(50);
  });
  it("התחשבנות מנכה חשבונות של בעל הדירה", () => {
    const s = settlement([b({})], [{ owner_id: "o", amount: 100 }], "all");
    expect(s[0]).toMatchObject({ company: 240, due: 1760, ded: 100, net: 1660 });
  });
  it("חשבונית עמלה כוללת מע״מ", () => {
    const i = invoiceLines([b({})], "o", "2026-12", 18);
    expect(i).toMatchObject({ net: 240, vat: 43, total: 283 });
  });
});
