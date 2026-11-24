import type { SupabaseClient } from "@supabase/supabase-js";
import { DEFAULT_FIN, type FinSettings, type PBooking, type PCost } from "./finance";
import { nowInJerusalem } from "./pricing";

export async function loadFinSettings(supabase: SupabaseClient): Promise<FinSettings> {
  const { data } = await supabase.from("settings").select("key, value").in("key", ["vat_percent", "oncost_percent"]);
  const g = (k: string, d: number) => { const v = Number((data ?? []).find((r) => r.key === k)?.value); return Number.isFinite(v) && v >= 0 && (data ?? []).some((r) => r.key === k) ? v : d; };
  return { vatPct: g("vat_percent", DEFAULT_FIN.vatPct), oncostPct: g("oncost_percent", DEFAULT_FIN.oncostPct) };
}

export const monthParam = (m?: string, allowAll = true) =>
  m === "all" && allowAll ? "all" : /^\d{4}-\d{2}$/.test(m ?? "") ? m! : nowInJerusalem().slice(0, 7);

export async function loadPBookings(supabase: SupabaseClient): Promise<PBooking[]> {
  const { data } = await supabase.from("bookings")
    .select("check_in, status, total_price, deposit_required, apartment_id, apartments(name, owner_id, owners(name))").neq("status", "expired");
  return (data ?? []).map((b: any) => ({
    apartment_id: b.apartment_id, apartment: b.apartments?.name ?? "", owner_id: b.apartments?.owner_id ?? "", owner: b.apartments?.owners?.name ?? "",
    check_in: b.check_in, status: b.status, total_price: b.total_price, deposit_required: b.deposit_required,
  }));
}

/** עלויות ישירות לפי חודש: חשבונות נכס ששילמה החברה, תחזוקה שבוצעה, ניקיון ופרסום. */
export async function loadCosts(supabase: SupabaseClient): Promise<(PCost & { owner_id?: string })[]> {
  const [bills, tasks, cleans, ads] = await Promise.all([
    supabase.from("apartment_bills").select("period, amount, charge_owner, apartment_id, bill_type, apartments(owner_id)").eq("paid_by", "company").eq("paid", true),
    supabase.from("maintenance_tasks").select("due_on, created_at, est_cost, charge_owner, apartment_id, apartments(owner_id)").eq("status", "done").gt("est_cost", 0),
    supabase.from("cleanings").select("done_at, cost, bookings(apartment_id)").gt("cost", 0),
    supabase.from("ad_spend").select("starts_on, cost, apartment_id").gt("cost", 0),
  ]);
  return [
    ...(bills.data ?? []).map((b: any) => ({ month: b.period, category: "חשבונות נכס", amount: b.amount, apartment_id: b.apartment_id, charge_owner: b.charge_owner, owner_id: b.apartments?.owner_id })),
    ...(tasks.data ?? []).map((t: any) => ({ month: (t.due_on ?? t.created_at).slice(0, 7), category: "תחזוקה", amount: t.est_cost, apartment_id: t.apartment_id, charge_owner: t.charge_owner, owner_id: t.apartments?.owner_id })),
    ...(cleans.data ?? []).map((c: any) => ({ month: c.done_at.slice(0, 7), category: "ניקיון", amount: c.cost, apartment_id: c.bookings?.apartment_id, charge_owner: false })),
    ...(ads.data ?? []).map((a: any) => ({ month: a.starts_on.slice(0, 7), category: "שיווק ופרסום", amount: a.cost, apartment_id: a.apartment_id, charge_owner: false })),
  ];
}

export async function loadPayrollCost(supabase: SupabaseClient, month: string, oncostPct: number) {
  const [{ data: emps }, { data: pay }] = await Promise.all([
    supabase.from("employees").select("id, pay_kind, rate"),
    supabase.from("payroll").select("employee_id, month, hours, bonus"),
  ]);
  let total = 0;
  for (const p of (pay ?? []).filter((x) => month === "all" || x.month === month)) {
    const e = (emps ?? []).find((x) => x.id === p.employee_id); if (!e) continue;
    const base = e.pay_kind === "hourly" ? Number(p.hours) * e.rate : e.rate;
    total += (base + p.bonus) * (1 + oncostPct / 100);
  }
  return total;
}
