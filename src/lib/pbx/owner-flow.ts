import { addDays, dowOf } from "../pricing";
import { describeStay } from "./speech";
import { digits, hangup, menu, normPhone, say, type PbxModule, type PbxParams, type PbxResponse } from "./types";

export interface OwnerRec { id: string; name: string }
export interface Pending { id: string; kind: "booked" | "cancelled"; apartment_name: string; short_code: number | null; check_in: string; check_out: string }

export interface OwnerDeps {
  findOwnerByPhone(phone: string): Promise<OwnerRec | null>;
  findOwnerByPin(pin: string): Promise<OwnerRec | null>;
  apartmentByCode(ownerId: string, code: number): Promise<{ id: string; name: string } | null>;
  pendingFor(ownerId: string): Promise<Pending[]>;
  markDelivered(ids: string[]): Promise<void>;
  /** חוסם או פותח לילות. מחזיר כמה לילות השתנו. */
  setNights(apartmentId: string, nights: string[], blocked: boolean): Promise<number>;
  today(): string; // YYYY-MM-DD בישראל
}

/** הסופ"ש הקרוב (או שאחריו): לילות חמישי ושישי שעוד לא עברו. */
export function weekendNights(today: string, which: 1 | 2): { from: string; to: string; nights: string[] } {
  let sat = addDays(today, (6 - dowOf(today) + 7) % 7);
  if (sat === today) sat = addDays(sat, 7); // היום שבת: הסופ"ש הבא
  if (which === 2) sat = addDays(sat, 7);
  const nights = [addDays(sat, -2), addDays(sat, -1)].filter((n) => n >= today);
  return { from: addDays(sat, -2), to: sat, nights };
}

/** ארבע ספרות יום וחודש (למשל 0412) לתאריך הקרוב ביותר שלא עבר. */
export function parseDayMonth(dd: string, today: string): string | null {
  if (!/^\d{4}$/.test(dd)) return null;
  const day = Number(dd.slice(0, 2)), mon = Number(dd.slice(2));
  if (mon < 1 || mon > 12 || day < 1 || day > 31) return null;
  for (const y of [Number(today.slice(0, 4)), Number(today.slice(0, 4)) + 1]) {
    const c = `${y}-${String(mon).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    if (new Date(c + "T00:00:00Z").getUTCDate() === day && c >= today) return c;
  }
  return null;
}

export async function ownerFlow(q: PbxParams, deps: OwnerDeps): Promise<PbxResponse> {
  if (q.PBXcallStatus === "HANGUP") return hangup();

  let owner = await deps.findOwnerByPhone(normPhone(q.PBXphone));
  if (!owner) {
    if (q.pin === undefined) return digits("pin", "ברוכים הבאים לקו בעלי הדירות של נִיחָא. הקישו את הקוד האישי שלכם.", 3, 8);
    owner = await deps.findOwnerByPin(q.pin);
    if (!owner) return [say("הקוד אינו מזוהה. להתראות."), hangup()];
  }

  // 1. הקראת הודעות שממתינות (פעם אחת)
  if (q.menu === undefined) {
    const pending = await deps.pendingFor(owner.id);
    const mods: PbxModule[] = [];
    if (pending.length) {
      const lines = pending.map((p) =>
        `דירה ${p.apartment_name}${p.short_code ? ` מספר ${p.short_code}` : ""} ${p.kind === "booked" ? "נתפסה" : "שוחררה, ההזמנה בוטלה"} ל${describeStay(p.check_in, p.check_out)}.`);
      mods.push(say(`שלום ${owner.name}. ${lines.join(" ")}`));
      await deps.markDelivered(pending.map((p) => p.id));
    } else {
      mods.push(say(`שלום ${owner.name}.`));
    }
    mods.push(menu("menu", "לעדכון דירה תפוסה או פנויה הקישו 1. לסיום הקישו 2.", "12"));
    return mods;
  }
  if (q.menu !== "1") return [say("להתראות."), hangup()];

  // 2. איזו דירה
  const aptPrompt = digits("apt", "הקישו את מספר הדירה.", 1, 4);
  if (q.apt === undefined) return aptPrompt;
  const apt = await deps.apartmentByCode(owner.id, Number(q.apt));
  if (!apt) return [say("מספר דירה לא נמצא."), aptPrompt];

  // 3. איזה תאריך
  if (q.when === undefined) return menu("when", "לסופ\"ש הקרוב הקישו 1. לסופ\"ש שאחריו הקישו 2. לתאריך אחר הקישו 3.", "123");
  const today = deps.today();
  let from: string, to: string, nights: string[];
  if (q.when === "1" || q.when === "2") {
    ({ from, to, nights } = weekendNights(today, q.when === "1" ? 1 : 2));
  } else {
    if (q.date === undefined) return digits("date", "הקישו יום וחודש בארבע ספרות. למשל, אפס ארבע אחת שתיים לרביעי בדצמבר.", 4, 4);
    const d = parseDayMonth(q.date, today);
    if (!d) return [say("התאריך אינו תקין."), digits("date", "הקישו יום וחודש בארבע ספרות.", 4, 4)];
    from = d; to = addDays(d, 1); nights = [d];
  }
  if (!nights.length) return [say("התאריכים האלה כבר עברו."), hangup()];

  // 4. תפוס או פנוי
  if (q.state === undefined) return menu("state", `${apt.name}, ${describeStay(from, to)}. תפוס הקישו 1. פנוי הקישו 2.`, "12");
  const blocked = q.state === "1";
  const changed = await deps.setNights(apt.id, nights, blocked);
  const what = `${apt.name} ${blocked ? "סומנה כתפוסה" : "סומנה כפנויה"} ל${describeStay(from, to)}`;
  return [say(changed ? `${what}. תודה ולהתראות.` : `לא בוצע שינוי. הלילות כבר במצב הזה, או שיש עליהם הזמנה. להתראות.`), hangup()];
}
