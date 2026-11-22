import { createClient } from "@/lib/supabase/server";
import { buildIcal } from "@/lib/ical";

export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(token)) return new Response("Not found", { status: 404 });
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("ical_feed", { p_token: token });
  if (error) return new Response("Error", { status: 500 });
  const body = buildIcal("נייחא", (data ?? []).map((r: any) => ({ from: r.d_from, to: r.d_to, kind: r.kind })));
  return new Response(body, {
    headers: { "Content-Type": "text/calendar; charset=utf-8", "Cache-Control": "private, max-age=300" },
  });
}
