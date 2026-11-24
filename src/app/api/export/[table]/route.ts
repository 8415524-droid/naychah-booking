import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { toCsv } from "@/lib/csv";

// טבלאות שמותר לייצא. בלי profiles/settings (סודות).
const EXPORTABLE = ["bookings", "customers", "payments", "apartments", "owners", "pricing_rules", "blocks", "call_log"] as const;

export async function GET(_req: Request, ctx: { params: Promise<{ table: string }> }) {
  const { table } = await ctx.params;
  if (!(EXPORTABLE as readonly string[]).includes(table)) return new NextResponse("לא נמצא", { status: 404 });
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new NextResponse("נדרשת התחברות", { status: 401 });
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") return new NextResponse("אין הרשאה", { status: 403 });
  const { data, error } = await supabase.from(table).select("*").limit(50000);
  if (error) return new NextResponse(error.message, { status: 500 });
  const day = new Date().toISOString().slice(0, 10);
  return new NextResponse(toCsv((data ?? []) as Record<string, unknown>[]), {
    headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="${table}-${day}.csv"` },
  });
}
