import { adminClient } from "@/lib/supabase/admin";
import { parseCompleted } from "@/lib/pbx/events";

/** webhook של המרכזייה: בסיום שיחה שנוּתבה מגיעה כאן ההקלטה, ונשמרת ביומן השיחות. מאומת לפי הסוד בכתובת. */
export async function POST(req: Request, { params }: { params: Promise<{ secret: string }> }) {
  const { secret } = await params;
  if (!process.env.PBX_SECRET || secret !== process.env.PBX_SECRET) return new Response("Not found", { status: 404 });
  let body: unknown;
  try { body = await req.json(); } catch { return new Response("bad json", { status: 400 }); }
  const call = parseCompleted(body);
  if (!call) return new Response("ok"); // אירועים אחרים לא נשמרים
  const sb = adminClient();
  const since = new Date(Date.now() - 3 * 3600_000).toISOString();
  let rowId: string | null = null;
  if (call.phone) {
    const { data } = await sb.from("call_log").select("id").eq("direction", call.direction).eq("phone", call.phone)
      .is("recording_url", null).gte("created_at", since).order("created_at", { ascending: false }).limit(1);
    rowId = data?.[0]?.id ?? null;
  }
  const fields = { recording_url: call.recordingUrl, duration_s: call.durationS };
  const { error } = rowId
    ? await sb.from("call_log").update(fields).eq("id", rowId)
    : await sb.from("call_log").insert({ direction: call.direction, kind: "customer", phone: call.phone, ...fields });
  if (error) return new Response("db error", { status: 500 }); // המרכזייה תנסה שוב
  return new Response("ok");
}
