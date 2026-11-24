import { describe, expect, it } from "vitest";
import { busyNightCount, evaluate, rank, type SearchApt, type SearchQuery } from "./search-engine";

const base: SearchQuery = { guests: 0, rooms: 0, budget: 0, text: "", maxDistM: 0, showers: 0, toilets: 0, sqm: 0, sofaBeds: 0, cribs: 0, parking: 0, condition: "", floor: null, flags: [] };
const apt = (o: Partial<SearchApt> = {}): SearchApt => ({ name: "דירה א", beds: 8, rooms: 4, ...o });
const ctx = { nights: 2, busyNights: 0, total: 1500 };

describe("evaluate", () => {
  it("בלי דרישות: מתאימה לגמרי", () => {
    const e = evaluate(apt(), base, ctx);
    expect(e.exact).toBe(true);
    expect(e.oks).toContain("פנויה בתאריכים");
  });
  it("פחות מיטות: מסומן כמה חסר", () => {
    const e = evaluate(apt({ beds: 6 }), { ...base, guests: 8 }, ctx);
    expect(e.exact).toBe(false);
    expect(e.gaps[0].t).toContain("חסרות 2 מיטות");
    expect(e.score).toBe(2);
  });
  it("חסרות יותר משתי מיטות: ציון גבוה, לא כמעט מתאימה", () => {
    const e = evaluate(apt({ beds: 4 }), { ...base, guests: 8 }, ctx);
    expect(e.score).toBeGreaterThan(5);
  });
  it("תפוסה חלקית ותפוסה מלאה", () => {
    const p = evaluate(apt(), base, { ...ctx, busyNights: 1 });
    expect(p.partial).toBe(true);
    expect(p.gaps[0].t).toBe("תפוסה 1 מתוך 2 לילות");
    expect(evaluate(apt(), base, { ...ctx, busyNights: 2 }).hard).toBe(true);
  });
  it("מחיר גבוה בכמה שקלים", () => {
    const e = evaluate(apt(), { ...base, budget: 1380 }, ctx);
    expect(e.gaps[0].t).toContain("יקרה ב");
    expect(e.gaps[0].t).toContain("120");
  });
  it("מינימום חדרים", () => {
    expect(evaluate(apt({ rooms: 3 }), { ...base, rooms: 5 }, ctx).gaps[0].t).toContain("חסרים 2 חדרים".replace("חסרים", "חסר"));
    expect(evaluate(apt({ rooms: 5 }), { ...base, rooms: 5 }, ctx).exact).toBe(true);
  });
  it("חיפוש חופשי בשם, כתובת והערות", () => {
    expect(evaluate(apt({ address: "רחוב הרב שמעון" }), { ...base, text: "שמעון" }, ctx).exact).toBe(true);
    expect(evaluate(apt({ notes: "ליד הכניסה" }), { ...base, text: "ליד כניסה" }, ctx).exact).toBe(true);
    expect(evaluate(apt(), { ...base, text: "צפת" }, ctx).exact).toBe(false);
  });
  it("מאפיין: יש / אין / לא הוזן / מאפיין ישן", () => {
    const q = { ...base, flags: ["safe_room"] };
    expect(evaluate(apt({ amenities: ["safe_room"] }), q, ctx).exact).toBe(true);
    expect(evaluate(apt({ amenities: ["ac"] }), q, ctx).gaps[0].t).toBe('אין ממ"ד');
    expect(evaluate(apt(), q, ctx).gaps[0].level).toBe("unknown");
    expect(evaluate(apt({ features: ["מזגן"] }), { ...base, flags: ["ac"] }, ctx).exact).toBe(true);
    expect(evaluate(apt({ has_yard: true }), { ...base, flags: ["has_yard"] }, ctx).exact).toBe(true);
  });
  it("מיטות תינוק וחניות, כולל המאפיין הישן", () => {
    expect(evaluate(apt({ cribs: 1 }), { ...base, cribs: 2 }, ctx).gaps[0].t).toBe("יש 1 מיטות תינוק, צריך 2");
    expect(evaluate(apt({ features: ["חניה"] }), { ...base, parking: 1 }, ctx).exact).toBe(true);
  });
  it("מרחק מהציון", () => {
    expect(evaluate(apt({ distance_from_tomb_m: 300 }), { ...base, maxDistM: 500 }, ctx).exact).toBe(true);
    expect(evaluate(apt({ distance_from_tomb_m: 900 }), { ...base, maxDistM: 500 }, ctx).exact).toBe(false);
  });
});

describe("busyNightCount", () => {
  it("סופר לילות תפוסים בלי כפילות", () => {
    const r = [{ from: "2026-12-03", to: "2026-12-04" }, { from: "2026-12-03", to: "2026-12-04" }];
    expect(busyNightCount("2026-12-03", "2026-12-05", r)).toBe(1);
    expect(busyNightCount("2026-12-04", "2026-12-05", r)).toBe(0);
  });
});

describe("rank", () => {
  const mk = (name: string, o: Partial<SearchApt>, q: SearchQuery, total: number) => {
    const a = apt({ name, ...o });
    return { apt: a, total, ev: evaluate(a, q, { nights: 2, busyNights: 0, total }) };
  };
  it("מתאימות לפני כמעט מתאימות, ותפוסות לגמרי נשמטות", () => {
    const q = { ...base, guests: 8 };
    const rows = [mk("קרובה", { beds: 7 }, q, 1000), mk("מדויקת", { beds: 8 }, q, 1400), mk("גדולה", { beds: 12 }, q, 900)];
    const { exact, near } = rank(rows, 8, "best");
    expect(exact.map((r) => r.apt.name)).toEqual(["מדויקת", "גדולה"]);
    expect(near.map((r) => r.apt.name)).toEqual(["קרובה"]);
  });
  it("מיון לפי מחיר ולפי מרחק", () => {
    const rows = [mk("א", { distance_from_tomb_m: 500 }, base, 1000), mk("ב", { distance_from_tomb_m: 100 }, base, 2000)];
    expect(rank(rows, 0, "price").exact[0].apt.name).toBe("א");
    expect(rank(rows, 0, "distance").exact[0].apt.name).toBe("ב");
  });
});
