import { describe, expect, it, vi } from "vitest";
import { ownerFlow, parseDayMonth, weekendNights, type OwnerDeps } from "./owner-flow";
import { mainFlow, type MainDeps } from "./main-flow";

const owner = { id: "o1", name: "משה" };
function deps(over: Partial<OwnerDeps> = {}): OwnerDeps {
  return {
    findOwnerByPhone: async (p) => (p === "0501234567" ? owner : null),
    findOwnerByPin: async (p) => (p === "1234" ? owner : null),
    apartmentByCode: async (_o, c) => (c === 12 ? { id: "a1", name: "הגפן" } : null),
    pendingFor: async () => [],
    markDelivered: async () => {},
    setNights: async () => 2,
    today: () => "2026-12-01", // יום שלישי
    ...over,
  };
}
const mods = (r: any) => (Array.isArray(r) ? r : [r]);
const texts = (r: any) => mods(r).flatMap((m: any) => (m.files ?? []).map((f: any) => f.text)).join(" | ");

describe("תאריכים", () => {
  it("סופ\"ש קרוב ולאחריו", () => {
    expect(weekendNights("2026-12-01", 1)).toMatchObject({ from: "2026-12-03", to: "2026-12-05", nights: ["2026-12-03", "2026-12-04"] });
    expect(weekendNights("2026-12-01", 2).to).toBe("2026-12-12");
    expect(weekendNights("2026-12-04", 1).nights).toEqual(["2026-12-04"]); // בשישי רק ליל שישי
    expect(weekendNights("2026-12-05", 1).to).toBe("2026-12-12"); // בשבת: הסופ"ש הבא
  });
  it("יום וחודש", () => {
    expect(parseDayMonth("0412", "2026-12-01")).toBe("2026-12-04");
    expect(parseDayMonth("0101", "2026-12-01")).toBe("2027-01-01");
    expect(parseDayMonth("3102", "2026-12-01")).toBeNull();
    expect(parseDayMonth("12", "2026-12-01")).toBeNull();
  });
});

describe("קו בעלי דירות", () => {
  const caller = { PBXphone: "972501234567" };
  it("מזהה לפי טלפון ומקריא הודעות ממתינות פעם אחת", async () => {
    const markDelivered = vi.fn(async () => {});
    const r = await ownerFlow(caller, deps({
      pendingFor: async () => [{ id: "n1", kind: "booked", apartment_name: "הגפן", short_code: 12, check_in: "2026-12-03", check_out: "2026-12-05" }],
      markDelivered,
    }));
    expect(texts(r)).toContain("נתפסה");
    expect(texts(r)).toContain("מחמישי עד שבת");
    expect(markDelivered).toHaveBeenCalledWith(["n1"]);
  });
  it("מתקשר לא מזוהה מתבקש להקיש קוד, וקוד שגוי מנתק", async () => {
    expect(mods(await ownerFlow({ PBXphone: "0599999999" }, deps()))[0].type).toBe("getDTMF");
    expect(mods(await ownerFlow({ PBXphone: "0599999999", pin: "0000" }, deps())).at(-1)).toEqual({ type: "hangup" });
    expect(mods(await ownerFlow({ PBXphone: "0599999999", pin: "1234" }, deps()))[0].type).toBe("simpleMessage");
  });
  it("דירה של בעלים אחר לא נמצאת", async () => {
    const r = await ownerFlow({ ...caller, menu: "1", apt: "99" }, deps());
    expect(texts(r)).toContain("לא נמצא");
  });
  it("סימון סופ\"ש כתפוס כותב לילות ומקריא אישור", async () => {
    const setNights = vi.fn(async () => 2);
    const r = await ownerFlow({ ...caller, menu: "1", apt: "12", when: "1", state: "1" }, deps({ setNights }));
    expect(setNights).toHaveBeenCalledWith("a1", ["2026-12-03", "2026-12-04"], true);
    expect(texts(r)).toContain("סומנה כתפוסה");
  });
  it("תאריך בודד", async () => {
    const setNights = vi.fn(async () => 1);
    await ownerFlow({ ...caller, menu: "1", apt: "12", when: "3", date: "0912", state: "2" }, deps({ setNights }));
    expect(setNights).toHaveBeenCalledWith("a1", ["2026-12-09"], false);
  });
});

describe("קו לקוחות", () => {
  const d: MainDeps = {
    settings: async () => ({ secretary: "0501112222", service: "0503334444", routerId: "", musicUrl: "" }),
    bookingsByPhone: async (p) => (p === "0521111111"
      ? [{ apartment_name: "הגפן", check_in: "2026-12-03", check_out: "2026-12-05", status: "confirmed", total: 3000, deposit_required: 360, paid: 360 }]
      : []),
    latestBooking: async (p) => (p === "0521111111" ? { apartment_name: "הגפן", check_in: "2026-12-03", check_out: "2026-12-05", status: "confirmed" } : null),
  };
  it("תפריט ראשי וניתוב למזכירה", async () => {
    expect(texts(await mainFlow({}, d))).toContain("ברוכים הבאים לנייחא");
    const r: any = await mainFlow({ main: "1" }, d);
    expect(r.at(-1)).toMatchObject({ type: "simpleRouting", dialPhone: "0501112222", routingMusic: "yes" });
  });
  it("תור המתנה כשמוגדר ראוטר", async () => {
    const r: any = await mainFlow({ main: "1" }, { ...d, settings: async () => ({ secretary: "", service: "", routerId: "77", musicUrl: "" }) });
    expect(r.at(-1)).toMatchObject({ type: "queueRouting", routerId: "77" });
  });
  it("בירור מקריא הזמנה קיימת", async () => {
    expect(texts(await mainFlow({ main: "2", PBXphone: "0521111111" }, d))).toContain("הגפן");
  });
  it("שלוחה 4 מזהה את המתקשר ומקריאה את ההזמנה שלו", async () => {
    const t = texts(await mainFlow({ main: "4", PBXphone: "972521111111" }, d));
    expect(t).toContain("הגפן");
    expect(t).toContain("3000 שקלים");
    expect(t).toContain("נותר לשלם 2640 שקלים");
  });
  it("שלוחה 4 למתקשר לא מוכר מעבירה לנציג", async () => {
    const r: any = await mainFlow({ main: "4", PBXphone: "0599999999" }, d);
    expect(texts(r)).toContain("לא נמצאה הזמנה");
    expect(r.at(-1)).toMatchObject({ type: "simpleRouting" });
  });
  it("חזרה מניתוב מנתקת", async () => {
    expect(await mainFlow({ route1: "ANSWER" }, d)).toEqual({ type: "hangup" });
  });
});
