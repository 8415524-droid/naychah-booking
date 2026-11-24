import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { ownerFlow, parseDayMonth, weekendNights, type OwnerDeps } from "./owner-flow";
import { mainFlow, type MainDeps } from "./main-flow";
import clipsJson from "./clips.json";

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
const clipText = (f: any) => f.text ?? (clipsJson as { key: string; text: string }[]).find((c) => f.fileName === `${c.key}_v8`)?.text;
const texts = (r: any) => mods(r).flatMap((m: any) => (m.files ?? []).map(clipText)).join(" | ");

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
    expect(texts(await mainFlow({}, d))).toContain("שלום וברוכים הבאים לְנַיְיחַא");
    const r: any = await mainFlow({ main: "1" }, d);
    expect(r.at(-1)).toMatchObject({ type: "simpleRouting", dialPhone: "0501112222", routingMusic: "yes" });
  });
  it("תור המתנה כשמוגדר ראוטר", async () => {
    const r: any = await mainFlow({ main: "1" }, { ...d, settings: async () => ({ secretary: "0501112222", service: "", routerId: "77", musicUrl: "" }) });
    expect(r.at(-1)).toMatchObject({ type: "queueRouting", name: "queueResult1", phones: ["0501112222"] });
  });
  it("בירור מקריא הזמנה קיימת", async () => {
    expect(texts(await mainFlow({ main: "2", PBXphone: "0521111111" }, d))).toContain("הגפן");
  });
  it("שלוחה 2 מזהה את המתקשר, מקריאה את ההזמנה ומנתקת, בלי העברה לנציג", async () => {
    const r: any = await mainFlow({ main: "2", PBXphone: "972521111111" }, d);
    const t = texts(r);
    expect(t).toContain("הגפן");
    expect(t).toContain("נותר לשלם 2640 שקלים");
    expect(r.at(-1)).toMatchObject({ type: "hangup" });
    expect(r.some((m: any) => m.type === "simpleRouting")).toBe(false);
  });
  it("שלוחה 2 למתקשר לא מוכר מודיעה ומנתקת, בלי העברה", async () => {
    const r: any = await mainFlow({ main: "2", PBXphone: "0599999999" }, d);
    expect(texts(r)).toContain("לא נמצאה הזמנה");
    expect(r.at(-1)).toMatchObject({ type: "hangup" });
    expect(r.some((m: any) => m.type === "simpleRouting")).toBe(false);
  });
  it("חזרה מניתוב מנתקת", async () => {
    expect(await mainFlow({ route1: "ANSWER" }, d)).toEqual({ type: "hangup" });
  });

  it("שלוחה 4 מקליטה הודעה, ושומרת אותה כשחוזרת", async () => {
    const r: any = await mainFlow({ main: "4" }, d);
    expect(r[0]).toMatchObject({ type: "record", name: "msg" });
    const saved: any[] = [];
    const out: any = await mainFlow({ main: "4", PBXphone: "0521111111", FILEID_msg: "abc", DURATION_msg: "7" }, { ...d, saveMessage: async (m) => { saved.push(m); } });
    expect(saved[0]).toMatchObject({ phone: "0521111111", fileId: "abc", seconds: 7 });
    expect(out.at(-1)).toMatchObject({ type: "hangup" });
  });

  it("תור: אחרי סבב בלי מענה אומרים מספר בתור ומציעים הודעה, ואז ממשיכים או מקליטים", async () => {
    const dq = { ...d, settings: async () => ({ secretary: "0501112222", service: "", routerId: "77", musicUrl: "" }), queue: { position: async () => 11, leave: async () => {} } }; // מעל 10 אין הקראה מוקלטת, לכן הקראה ממוכנת
    const r1: any = await mainFlow({ main: "1", PBXcallId: "c1", queueResult1: "NOANSWER" }, dq);
    expect(r1[0].files[0].text).toContain("מספר 11");
    expect(r1[1]).toMatchObject({ type: "simpleMenu", name: "waitq1" });
    const r2: any = await mainFlow({ main: "1", PBXcallId: "c1", queueResult1: "NOANSWER", waitq1: "4" }, dq);
    expect(r2[0]).toMatchObject({ type: "record", name: "msg" });
    const r3: any = await mainFlow({ main: "1", PBXcallId: "c1", queueResult1: "NOANSWER", waitq1: "ERROR" }, dq);
    expect(r3[0]).toMatchObject({ type: "queueRouting", name: "queueResult2" });
  });

  it("תור: מקום 1 עד 10 מושמע מקובץ מוקלט אם הוא קיים", async () => {
    const dq = { ...d, settings: async () => ({ secretary: "0501112222", service: "", routerId: "77", musicUrl: "" }), queue: { position: async () => 3, leave: async () => {} } };
    const r1: any = await mainFlow({ main: "1", PBXcallId: "c1", queueResult1: "NOANSWER" }, dq);
    const clip = existsSync(join(process.cwd(), "public/audio/queue/queue_pos_3.mp3"));
    if (clip) expect(r1[0]).toMatchObject({ type: "simpleMenu", name: "waitq1", enabledKeys: "4", files: [{ fileName: "queue_pos_3_v1" }] });
    else expect(r1[0].files[0].text).toContain("מספר 3");
  });
});
