import type { SupabaseClient } from "@supabase/supabase-js";
import { geocode, walkToTziyun, type Coords } from "@/lib/geo";

export type LocateResult = { ok: true; minutes: number } | { ok: false; reason: string };

// מחשב זמן הליכה מהציון ושומר בדירה. בלי קואורדינטות קיימות מנסה לאתר לפי הכתובת.
export async function locateApartment(
  supabase: SupabaseClient,
  apt: { id: string; address: string | null; lat: number | null; lng: number | null },
  opts: { fromAddress?: boolean } = {},
): Promise<LocateResult> {
  let at: Coords | null = !opts.fromAddress && apt.lat != null && apt.lng != null ? { lat: apt.lat, lng: apt.lng } : null;
  if (!at) {
    if (!apt.address?.trim()) return { ok: false, reason: "אין כתובת לדירה" };
    at = await geocode(apt.address);
    if (!at) return { ok: false, reason: "לא נמצא מיקום לפי הכתובת. אפשר להדביק קואורדינטות מגוגל מפות" };
  }
  const walk = await walkToTziyun(at);
  if (!walk) return { ok: false, reason: "חישוב ההליכה נכשל, נסו שוב בעוד רגע" };
  const { error } = await supabase.from("apartments").update({
    lat: at.lat, lng: at.lng, walk_minutes: walk.minutes, walk_meters: walk.meters, located_at: new Date().toISOString(),
  }).eq("id", apt.id);
  if (error) return { ok: false, reason: "שגיאה בשמירה (האם הורצה ההרחבה 007 במסד הנתונים?)" };
  return { ok: true, minutes: walk.minutes };
}
