import { adminClient } from "@/lib/supabase/admin";
import { syncApartmentIcal } from "@/lib/ical-sync";

/** סנכרון אוטומטי של יומנים חיצוניים לכל הדירות שהוגדרה להן כתובת ייבוא. נקרא פעם בשעה מהשרת (אותו סוד של הצינתוקים). */
export async function GET(_req: Request, { params }: { params: Promise<{ secret: string }> }) {
  const { secret } = await params;
  const expected = process.env.TZINTUK_SECRET;
  if (!expected || secret !== expected) return new Response("Not found", { status: 404 });
  const sb = adminClient();
  const { data: apts } = await sb.from("apartments").select("id, name, ical_import_url").not("ical_import_url", "is", null);
  const results: { apartment: string; ok: boolean; note: string }[] = [];
  for (const a of apts ?? []) {
    if (!a.ical_import_url) continue;
    const r = await syncApartmentIcal(sb, a.id, a.ical_import_url);
    results.push({ apartment: a.name, ok: r.ok, note: r.ok ? `יובאו ${r.added}, דולגו ${r.skipped}` : r.error ?? "" });
  }
  return Response.json({ results });
}
