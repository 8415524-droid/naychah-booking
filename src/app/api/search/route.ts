import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { fmtDate } from "@/lib/weekends";
import { navGroups } from "@/lib/nav";

type Hit = { kind: string; label: string; sub?: string; href: string };

export async function GET(req: Request) {
  const { supabase, role } = await getSession();
  const term = (new URL(req.url).searchParams.get("q") ?? "").trim().replace(/[%,()]/g, "");
  if (term.length < 2) return NextResponse.json({ hits: [] });
  const staff = role === "admin" || role === "agent";
  const hits: Hit[] = [];

  for (const g of navGroups(role)) for (const it of g.items) {
    if (!it.external && it.label.includes(term)) hits.push({ kind: "עמוד", label: it.label, href: it.href });
  }
  if (role !== "none") {
    const { data } = await supabase.from("apartments").select("id, name, address").or(`name.ilike.%${term}%,address.ilike.%${term}%`).limit(8);
    for (const a of data ?? []) hits.push({ kind: "דירה", label: a.name, sub: a.address ?? undefined, href: `/apartments/${a.id}` });
  }
  if (staff) {
    // הזמנות: לפי שם או טלפון של הלקוח, או לפי מספר הזמנה (8 התווים הראשונים)
    const num = term.replace(/^#/, "").toLowerCase();
    const { data: custs } = await supabase.from("customers").select("id").or(`full_name.ilike.%${term}%,phone.ilike.%${term}%`).limit(20);
    const sel = "id, check_in, check_out, status, apartments(name), customers(full_name, phone)";
    const q = /^[0-9a-f]{8}$/.test(num)
      ? supabase.from("bookings").select(sel).gte("id", `${num}-0000-0000-0000-000000000000`).lte("id", `${num}-ffff-ffff-ffff-ffffffffffff`).limit(3)
      : custs?.length ? supabase.from("bookings").select(sel).in("customer_id", custs.map((c) => c.id)).order("created_at", { ascending: false }).limit(8) : null;
    const { data: bks } = q ? await q : { data: null };
    for (const b of (bks as any[] | null) ?? []) {
      hits.unshift({ kind: "הזמנה", label: `${b.customers?.full_name ?? ""} · ${b.apartments?.name ?? ""}`, sub: `${fmtDate(b.check_in)}–${fmtDate(b.check_out)} · #${String(b.id).slice(0, 8)}`, href: `/bookings/${b.id}` });
    }
  }
  if (staff) {
    const { data } = await supabase.from("customers").select("id, full_name, phone").or(`full_name.ilike.%${term}%,phone.ilike.%${term}%`).limit(8);
    for (const c of data ?? []) hits.push({ kind: "לקוח", label: c.full_name, sub: c.phone ?? undefined, href: `/customers/${c.id}` });
  }
  if (role === "admin") {
    const { data } = await supabase.from("owners").select("id, name, phone").or(`name.ilike.%${term}%,phone.ilike.%${term}%`).limit(6);
    for (const o of data ?? []) hits.push({ kind: "בעל דירה", label: o.name, sub: o.phone ?? undefined, href: "/owners" });
  }
  return NextResponse.json({ hits });
}
