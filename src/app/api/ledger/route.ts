import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { toCsv } from "@/lib/csv";
import { vatSplit } from "@/lib/finance";
import { loadCosts, loadFinSettings, loadPBookings, monthParam } from "@/lib/fin-data";

// יומן הנהלת חשבונות לחודש: הכנסות (מקדמות) והוצאות, עם מע״מ.
export async function GET(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new NextResponse("נדרשת התחברות", { status: 401 });
  const { data: p } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (p?.role !== "admin") return new NextResponse("אין הרשאה", { status: 403 });
  const month = monthParam(new URL(req.url).searchParams.get("m") ?? undefined);
  const inM = (d: string) => month === "all" || d.slice(0, 7) === month;
  const fin = await loadFinSettings(supabase);
  const [bookings, costs, { data: exps }] = await Promise.all([loadPBookings(supabase), loadCosts(supabase), supabase.from("expenses").select("spent_on, category, description, amount, includes_vat")]);
  const rows: Record<string, unknown>[] = [];
  for (const b of bookings.filter((x) => x.status === "confirmed" && inM(x.check_in)))
    rows.push({ תאריך: b.check_in, סוג: "הכנסה - מקדמה", תיאור: `${b.apartment} · ${b.owner}`, "לפני מע״מ": b.deposit_required, "מע״מ": Math.round(b.deposit_required * fin.vatPct) / 100, סיכום: b.deposit_required });
  for (const e of (exps ?? []).filter((x) => inM(x.spent_on))) {
    const s = vatSplit(e.amount, fin.vatPct, e.includes_vat);
    rows.push({ תאריך: e.spent_on, סוג: `הוצאה - ${e.category}`, תיאור: e.description ?? "", "לפני מע״מ": Math.round(s.net), "מע״מ": Math.round(s.vat), סיכום: e.amount });
  }
  for (const c of costs.filter((x) => (month === "all" || x.month === month) && !x.charge_owner))
    rows.push({ תאריך: `${c.month}-01`, סוג: `הוצאה - ${c.category}`, תיאור: "", "לפני מע״מ": c.amount, "מע״מ": 0, סיכום: c.amount });
  rows.sort((a, b) => String(a["תאריך"]).localeCompare(String(b["תאריך"])));
  return new NextResponse(toCsv(rows, ["תאריך", "סוג", "תיאור", "לפני מע״מ", "מע״מ", "סיכום"]), {
    headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="ledger-${month}.csv"` },
  });
}
