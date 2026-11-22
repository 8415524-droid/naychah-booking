import { adminClient } from "@/lib/supabase/admin";
import { normPhone } from "@/lib/pbx/types";

/**
 * עובד הצינתוקים. נקרא כל דקה (cron בשרת) ושולח צינתוק לבעלי דירות שיש להם הודעה שלא הוקראה.
 * הצינתוק הוא שיחה קצרה בלי קול שמציגה קוד בזיהוי המתקשר. בעל הדירה מתקשר חזרה לקו שלו
 * והמערכת מקריאה לו מה נתפס. makeCall של טכנוליין עובד רק מכתובת IP קבועה שאושרה אצלם.
 */
const MAX_ATTEMPTS = 3;
const RETRY_MIN = 10;

export async function GET(_req: Request, { params }: { params: Promise<{ secret: string }> }) {
  const { secret } = await params;
  const expected = process.env.TZINTUK_SECRET;
  if (!expected || secret !== expected) return new Response("Not found", { status: 404 });

  const sb = adminClient();
  const cutoff = new Date(Date.now() - RETRY_MIN * 60000).toISOString();
  const { data: pending } = await sb.from("owner_notifications")
    .select("id, owner_id, tzintuk_attempts, owners(callback_phone, phone, calendar_synced)")
    .is("delivered_at", null).lt("tzintuk_attempts", MAX_ATTEMPTS)
    .or(`tzintuk_last_at.is.null,tzintuk_last_at.lt.${cutoff}`);

  const byOwner = new Map<string, any[]>();
  for (const n of pending ?? []) byOwner.set(n.owner_id, [...(byOwner.get(n.owner_id) ?? []), n]);

  const base = process.env.TECHNOLINE_API_BASE ?? "https://api.tlivr.com/ivrFilesApi.php";
  const results: { owner: string; ok: boolean; note: string }[] = [];
  for (const [ownerId, list] of byOwner) {
    const o = (list[0] as any).owners;
    const phone = normPhone(o?.callback_phone || o?.phone);
    if (!o || o.calendar_synced || phone.length < 9) { results.push({ owner: ownerId, ok: false, note: "אין טלפון לצינתוק" }); continue; }
    const u = new URL(base);
    u.searchParams.set("action", "makeCall");
    u.searchParams.set("phone", phone);
    u.searchParams.set("cid", process.env.TZINTUK_CID ?? "1010");
    if (process.env.TECHNOLINE_CALLER_ID) u.searchParams.set("callerId", process.env.TECHNOLINE_CALLER_ID);
    let ok = false, note = "";
    try {
      const r = await fetch(u, { signal: AbortSignal.timeout(10000) });
      const j = await r.json().catch(() => null);
      ok = !!j && String(j.status).toLowerCase() === "ok";
      note = ok ? "נשלח" : `שגיאה ${r.status}${j?.errorCode ? " קוד " + j.errorCode : ""}`;
    } catch { note = "לא הצלחתי להגיע לטכנוליין"; }
    await sb.from("owner_notifications").update({ tzintuk_last_at: new Date().toISOString() }).in("id", list.map((n) => n.id));
    for (const n of list) await sb.from("owner_notifications").update({ tzintuk_attempts: n.tzintuk_attempts + 1 }).eq("id", n.id);
    await sb.from("call_log").insert({ direction: "out", kind: "tzintuk", phone, owner_id: ownerId, note });
    results.push({ owner: ownerId, ok, note });
  }
  return Response.json({ checked: byOwner.size, results });
}
