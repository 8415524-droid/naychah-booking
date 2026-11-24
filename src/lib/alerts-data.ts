import type { SupabaseClient } from "@supabase/supabase-js";
import { buildAlerts, type Alert } from "./alerts";
import { nowInJerusalem } from "./pricing";

/** שולף את הנתונים ובונה את ההתראות. משותף לדף ההתראות ולדשבורד. */
export async function loadAlerts(supabase: SupabaseClient): Promise<Alert[]> {
  const today = nowInJerusalem().slice(0, 10);
  const [{ data: bk }, { data: apts }, { data: rules }] = await Promise.all([
    supabase.from("bookings")
      .select("id, status, check_in, check_out, deposit_required, hold_expires_at, apartments(name), customers(full_name), payments(amount)")
      .in("status", ["hold", "confirmed"]).gte("check_out", today),
    supabase.from("apartments").select("id, name, owners(phone, calendar_synced)").eq("active", true),
    supabase.from("pricing_rules").select("apartment_id"),
  ]);
  const priced = new Set((rules ?? []).map((r: any) => r.apartment_id));
  return buildAlerts(
    (bk ?? []).map((b: any) => ({
      id: b.id, apartment: b.apartments?.name ?? "", customer: b.customers?.full_name ?? "", status: b.status,
      check_in: b.check_in, check_out: b.check_out, deposit_required: b.deposit_required, hold_expires_at: b.hold_expires_at,
      paid: (b.payments ?? []).reduce((s: number, p: any) => s + p.amount, 0),
    })),
    (apts ?? []).map((a: any) => ({
      id: a.id, name: a.name, hasPricing: priced.has(a.id),
      hasOwnerPhone: !!a.owners?.phone, calendarSynced: !!a.owners?.calendar_synced,
    })),
    today, Date.now(),
  );
}
