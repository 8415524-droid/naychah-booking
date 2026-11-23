import { describeStay } from "./speech";
import { afterRound, lastRound, queueRound, recordModule, type QueueDeps } from "./queue";
import { hangup, menu, pbxFiles, normPhone, say, type PbxModule, type PbxParams, type PbxResponse } from "./types";

export interface MainSettings { secretary: string; service: string; routerId: string; serviceRouterId?: string; musicUrl: string; welcomeAudioUrl?: string }
export interface MainDeps {
  settings(): Promise<MainSettings>;
  latestBooking(phone: string): Promise<{ apartment_name: string; check_in: string; check_out: string; status: string } | null>;
  /** הזמנות עתידיות של המתקשר (עד 3), עם סכומים בשקלים, לשלוחת "ההזמנה שלי". */
  bookingsByPhone(phone: string): Promise<MyBooking[]>;
  /** שמירת הודעה קולית שהמתקשר השאיר (שלוחה 4). */
  queue?: QueueDeps;
  saveMessage?(m: { phone: string; fileId: string; fileName: string; seconds: number }): Promise<void>;
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
  if (s.routerId && normPhone(s.secretary).length >= 9) return [queueRound(1, [normPhone(s.secretary)])];
  if (normPhone(s.secretary).length >= 9) return [route(name, s.secretary)];
  return [say("הקו אינו זמין כרגע. אנא נסו שוב מאוחר יותר."), hangup()];
}

export async function mainFlow(q: PbxParams, deps: MainDeps): Promise<PbxResponse> {
  // הודעה קולית שנקלטה (גם אם המתקשר ניתק באמצע ההקלטה)
  if (q.FILEID_msg && deps.saveMessage) {
    await deps.saveMessage({ phone: normPhone(q.PBXphone), fileId: q.FILEID_msg, fileName: q.FILE_msg ?? q.msg ?? "", seconds: Number(q.DURATION_msg ?? 0) || 0 });
    return q.PBXcallStatus === "HANGUP" ? hangup() : [say("תודה, ההודעה נשמרה ונחזור אליכם בהקדם."), hangup()];
  }
  // חזרה מסבב בתור ההמתנה (אין נציג פנוי): "הנך מספר X", הצעת הודעה, או סבב נוסף
  if (q.PBXcallStatus !== "HANGUP" && lastRound(q) > 0) {
    const set = await deps.settings();
    const isService = q.main === "3" && set.serviceRouterId;
    const phone = normPhone(isService ? set.service : set.secretary);
    const out = await afterRound(q, isService ? "service" : "booking", phone ? [phone] : [], deps.queue);
    if (out) return out;
  }
  if (q.PBXcallStatus === "HANGUP" && q.PBXcallId) await deps.queue?.leave(q.PBXcallId);
  // חזרה מניתוב או סיום שיחה
  if (q.PBXcallStatus === "HANGUP" || q.route1 !== undefined || lastRound(q) > 0 || q.route2 !== undefined || q.route3 !== undefined) return hangup();
  const s = await deps.settings();

  if (q.main === undefined || q.main === "ERROR") {
    const hello: PbxModule[] = [];
    if (s.musicUrl) hello.push({ type: "simpleMessage", files: [{ fileLink: s.musicUrl }] });
    const m = menu("main", "שלום וברוכים הבאים לנַיְיחָא. שבת של נחת במירון. להזמנת דירה הקישו 1. לבירורים לאחר סגירת הזמנה הקישו 2. לשירות לקוחות הקישו 3. להשארת הודעה הקישו 4.", "1234", true);
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
    if (s.serviceRouterId && normPhone(s.service).length >= 9) return [say("מעביר אותך לשירות לקוחות. אנא המתינו."), queueRound(1, [normPhone(s.service)])];
    if (normPhone(s.service).length >= 9) return [say("מעביר אותך לשירות לקוחות. אנא המתינו."), route("route3", s.service)];
    return [say("מעביר אותך לנציג."), ...toSecretary(s, "route3")];
  }
  if (q.main === "4") {
    return [recordModule("אנא השאירו הודעה אחרי הצליל, כולל שם ומספר טלפון, ונחזור אליכם בהקדם.")];
  }
  return hangup();
}
