import { describeStay } from "./speech";
import { hangup, menu, normPhone, say, type PbxModule, type PbxParams, type PbxResponse } from "./types";

export interface MainSettings { secretary: string; service: string; routerId: string; musicUrl: string }
export interface MainDeps {
  settings(): Promise<MainSettings>;
  latestBooking(phone: string): Promise<{ apartment_name: string; check_in: string; check_out: string; status: string } | null>;
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
    hello.push(menu("main", "ברוכים הבאים לנייחא. להזמנת דירה הקישו 1. לבירורים לאחר סגירת הזמנה הקישו 2. לשירות לקוחות הקישו 3.", "123", true));
    return hello;
  }
  if (q.main === "1") return [say("מעביר אותך להזמנת דירה. אנא המתינו."), ...toSecretary(s, "route1")];
  if (q.main === "2") {
    const b = await deps.latestBooking(normPhone(q.PBXphone));
    const intro = b
      ? [say(`נמצאה הזמנה לדירה ${b.apartment_name}, ${describeStay(b.check_in, b.check_out)}. מעביר אותך לנציג.`)]
      : [say("לא נמצאה הזמנה על המספר שממנו התקשרתם. מעביר אותך לנציג.")];
    return [...intro, ...toSecretary(s, "route2")];
  }
  if (q.main === "3") {
    if (normPhone(s.service).length >= 9) return [say("מעביר אותך לשירות לקוחות. אנא המתינו."), route("route3", s.service)];
    return [say("מעביר אותך לנציג."), ...toSecretary(s, "route3")];
  }
  return hangup();
}
