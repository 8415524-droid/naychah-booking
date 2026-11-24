import type { SupabaseClient } from "@supabase/supabase-js";
import { addDays, nowInJerusalem } from "./pricing";
import { isSafeIcalUrl, normalizeIcalUrl, parseIcal, type IcalRange } from "./ical";

/** מאחד טווחים חופפים או סמוכים (המערכת אוסרת חסימות חופפות, ויומנים חיצוניים לא תמיד נקיים). */
export function mergeRanges(ranges: IcalRange[]): IcalRange[] {
  const sorted = [...ranges].sort((a, b) => a.from.localeCompare(b.from));
  const out: IcalRange[] = [];
  for (const r of sorted) {
    const last = out[out.length - 1];
    if (last && r.from <= last.to) { if (r.to > last.to) last.to = r.to; }
    else out.push({ ...r });
  }
  return out;
}

/** מוריד יומן חיצוני. עוקב אחרי הפניות (בוקינג/אייר-בי-אן-בי מפנים), ובודק כל כתובת מחדש מול SSRF. */
export async function fetchIcalText(url: string): Promise<{ text?: string; error?: string }> {
  let cur = normalizeIcalUrl(url);
  for (let hop = 0; hop < 4; hop++) {
    if (!isSafeIcalUrl(cur)) return { error: "כתובת היומן אינה תקינה (נדרש https לכתובת ציבורית)" };
    let res: Response;
    try {
      res = await fetch(cur, { redirect: "manual", signal: AbortSignal.timeout(15000), headers: { "User-Agent": "naychah-calendar-sync", Accept: "text/calendar, */*" } });
    } catch {
      return { error: "לא הצלחתי להגיע ליומן החיצוני" };
    }
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get("location");
      if (!loc) return { error: `היומן החיצוני החזיר הפניה ${res.status} בלי יעד` };
      try { cur = new URL(loc, cur).toString(); } catch { return { error: "הפניה לא תקינה מהיומן החיצוני" }; }
      continue;
    }
    if (!res.ok) return { error: `היומן החיצוני החזיר שגיאה ${res.status}` };
    const text = (await res.text()).slice(0, 2_000_000);
    if (!text.includes("BEGIN:VCALENDAR")) return { error: "הכתובת לא מחזירה יומן iCal (אולי נדרשת כתובת ה-iCal הסודית)" };
    return { text };
  }
  return { error: "יותר מדי הפניות מהיומן החיצוני" };
}

/** מסנכרן דירה אחת: מחליף את חסימות ה-iCal שלה בתוכן היומן החיצוני. לא נוגע בכלום אם ההורדה נכשלה. */
export async function syncApartmentIcal(sb: SupabaseClient, apartmentId: string, url: string): Promise<{ ok: boolean; added: number; skipped: number; error?: string }> {
  const got = await fetchIcalText(url);
  if (!got.text) return { ok: false, added: 0, skipped: 0, error: got.error };
  const today = nowInJerusalem().slice(0, 10);
  const ranges = mergeRanges(parseIcal(got.text).filter((r) => r.to > today).map((r) => ({ from: r.from < today ? today : r.from, to: r.to })));
  await sb.from("blocks").delete().eq("apartment_id", apartmentId).eq("source", "ical");
  let added = 0, skipped = 0;
  for (const r of ranges) {
    const { error } = await sb.from("blocks").insert({ apartment_id: apartmentId, date_from: r.from, date_to: r.to, source: "ical" });
    if (error) {
      // חפיפה עם הזמנה או חסימה ידנית: מנסים לחסום רק את הלילות הפנויים
      let d = r.from;
      while (d < r.to) {
        const { error: e2 } = await sb.from("blocks").insert({ apartment_id: apartmentId, date_from: d, date_to: addDays(d, 1), source: "ical" });
        if (!e2) added++;
        d = addDays(d, 1);
      }
      skipped++;
    } else added++;
  }
  return { ok: true, added, skipped };
}
