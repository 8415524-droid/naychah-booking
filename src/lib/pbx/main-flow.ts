import { describeStay } from "./speech";
import { hangup, menu, normPhone, say, type PbxModule, type PbxParams, type PbxResponse } from "./types";

export interface MainSettings { secretary: string; service: string; routerId: string; serviceRouterId?: string; musicUrl: string; welcomeAudioUrl?: string }
export interface MainDeps {
  settings(): Promise<MainSettings>;
  latestBooking(phone: string): Promise<{ apartment_name: string; check_in: string; check_out: string; status: string } | null>;
  /** הזמנות עתידיות של המתקשר (עד 3), עם סכומים בשקלים, לשלוחת "ההזמנה שלי". */
  bookingsByPhone(phone: string): Promise<MyBooking[]>;
}
export interface MyBooking {
  apartment_name: string; check_in: string; check_out: string; status: string;
  total: number; deposit_required: number; paid: number;
}

/** הקראת הזמנה אחת: דירה, מועד, מחיר ומצב תשלום. */
export function readBooking(b: MyBooking): string {
  const head = `דירה ${b.apartment_name}, ${describeStay(b.check_in, b.check_out)}. מחיר כולל ${b.total} שקלים.`;
  if (b.status === "hold") {
    return `${head} ההזמנה עדיין לא סגורה, והיא ממתינה לתשלום מקדמה של ${b.deposit_required} שקלים.`;
  }
  const left = Math.max(0, b.total - b.paid);
  return `${head} שולם ${b.paid} שקלים, ונותר לשלם ${left} שקלים.`;
}

const route = (name: string, phone: string): PbxModule =>
  ({ type: "simpleRouting", name, dialPhone: normPhone(phone), routingMusic: "yes", ringSec: 30 });

function toSecretary(s: MainSettings, name: string): PbxModule[] {
  if (s.routerId) return [{ type: "queueRouting", name, routerId: s.routerId }];
  if (normPhone(s.secretary).length >= 9) return [route(name, s.secretary)];
  return [say("הקו אינו זמין כרגע. אנא נסו שוב מאוחר יותר."), hangup()];
}

export async function mainFlow(q: PbxParams, deps: MainDeps): Promise<PbxResponse> {
  // חזרה מניתוב או סיום שיחה
  if (q.PBXcallStatus === "HANGUP" || q.route1 !== undefined || q.route2 !== undefined || q.route3 !== undefined) return hangup();
  const s = await deps.settings();

  if (q.main === undefined || q.main === "ERROR") {
    const hello: PbxModule[] = [];
    if (s.musicUrl) hello.push({ type: "simpleMessage", files: [{ fileLink: s.musicUrl }] });
    const m = menu("main", "ברוכים הבאים לנַיְיחָא. להזמנת דירה הקישו 1. לבירורים לאחר סגירת הזמנה הקישו 2. לשירות לקוחות הקישו 3.", "123", true);
    // קריינות מוקלטת מראש (קול אנושי) מחליפה את ההקראה הממוכנת כשהוגדר קישור
    if (s.welcomeAudioUrl && m.type === "simpleMenu") m.files = [{ fileLink: s.welcomeAudioUrl }];
    hello.push(m);
    return hello;
  }
  if (q.main === "1") return [say("מעביר אותך להזמנת דירה. אנא המתינו."), ...toSecretary(s, "route1")];
  if (q.main === "2") {
    const list = await deps.bookingsByPhone(normPhone(q.PBXphone));
    if (!list.length) return [say("לא נמצאה הזמנה על המספר שממנו התקשרתם."), hangup()];
    const out: PbxModule[] = [say(list.length === 1 ? "נמצאה הזמנה אחת על שמכם." : `נמצאו ${list.length} הזמנות על שמכם.`)];
    for (const b of list) out.push(say(readBooking(b)));
    out.push(hangup());
    return out;
  }
  if (q.main === "3") {
    if (s.serviceRouterId) return [say("מעביר אותך לשירות לקוחות. אנא המתינו."), { type: "queueRouting", name: "route3", routerId: s.serviceRouterId }];
    if (normPhone(s.service).length >= 9) return [say("מעביר אותך לשירות לקוחות. אנא המתינו."), route("route3", s.service)];
    return [say("מעביר אותך לנציג."), ...toSecretary(s, "route3")];
  }
  return hangup();
}
