import type { SupabaseClient } from "@supabase/supabase-js";
import { geocode, walkToTziyun, type Coords } from "@/lib/geo";

export type LocateResult = { ok: true; minutes: number } | { ok: false; reason: string };

// מחשב זמן הליכה מהציון ושומר בדירה. בלי קואורדינטות קיימות מנסה לאתר לפי הכתובת.
export async function locateApartment(
  supabase: SupabaseClient,
  apt: { id: string; address: string | null; lat: number | null; lng: number | null },
  opts: { fromAddress?: boolean } = {},
): Promise<LocateResult> {
  // כשל נרשם ב-located_at כדי לא לנסות שוב ושוב (ניסיון חוזר אחרי יממה)
  const markTried = () => supabase.from("apartments").update({ located_at: new Date().toISOString() }).eq("id", apt.id);
  let at: Coords | null = !opts.fromAddress && apt.lat != null && apt.lng != null ? { lat: apt.lat, lng: apt.lng } : null;
  if (!at) {
    if (!apt.address?.trim()) return { ok: false, reason: "אין כתובת לדירה" };
    at = await geocode(apt.address);
    if (!at) { await markTried(); return { ok: false, reason: "לא נמצא מיקום לפי הכתובת. אפשר להדביק קואורדינטות מגוגל מפות" }; }
  }
  const walk = await walkToTziyun(at);
  if (!walk) { await markTried(); return { ok: false, reason: "חישוב ההליכה נכשל, נסו שוב בעוד רגע" }; }
  const { error } = await supabase.from("apartments").update({
    lat: at.lat, lng: at.lng, walk_minutes: walk.minutes, walk_meters: walk.meters, located_at: new Date().toISOString(),
  }).eq("id", apt.id);
  if (error) return { ok: false, reason: "שגיאה בשמירה (האם הורצה ההרחבה 007 במסד הנתונים?)" };
  return { ok: true, minutes: walk.minutes };
}

// איתור אוטומטי של דירות שיש להן כתובת ועוד אין זמן הליכה (רץ ברקע, בקשה לשנייה).
export async function locateMissing(supabase: SupabaseClient, limit = 6): Promise<number> {
  const dayAgo = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const { data, error } = await supabase.from("apartments").select("id, address, lat, lng")
    .is("walk_minutes", null).not("address", "is", null).neq("address", "")
    .or(`located_at.is.null,located_at.lt.${dayAgo}`).limit(limit);
  if (error) return 0; // המיגרציה עוד לא הורצה
  let done = 0;
  for (const a of data ?? []) {
    const r = await locateApartment(supabase, a);
    if (r.ok) done++;
    await new Promise((res) => setTimeout(res, 1100));
  }
  return done;
}
