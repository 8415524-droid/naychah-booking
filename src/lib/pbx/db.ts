import type { SupabaseClient } from "@supabase/supabase-js";
import { closeNight, openNight } from "../blocks";
import { nowInJerusalem } from "../pricing";
import type { MainDeps } from "./main-flow";
import type { OwnerDeps } from "./owner-flow";
import { normPhone } from "./types";

export function ownerDeps(sb: SupabaseClient): OwnerDeps {
  return {
    async findOwnerByPhone(phone) {
      if (phone.length < 9) return null;
      const { data } = await sb.from("owners").select("id, name, phone, phone2, callback_phone");
      const hit = data?.find((o) => [o.phone, o.phone2, o.callback_phone].some((p) => p && normPhone(p) === phone));
      return hit ? { id: hit.id, name: hit.name } : null;
    },
    async findOwnerByPin(pin) {
      if (!pin) return null;
      const { data } = await sb.from("owners").select("id, name").eq("pin", pin).limit(2);
      return data?.length === 1 ? data[0] : null; // קוד כפול אצל שני בעלים לא מזהה אף אחד
    },
    async apartmentByCode(ownerId, code) {
      const { data } = await sb.from("apartments").select("id, name").eq("owner_id", ownerId).eq("short_code", code).maybeSingle();
      return data;
    },
    async pendingFor(ownerId) {
      const { data } = await sb.from("owner_notifications")
        .select("id, kind, check_in, check_out, apartments(name, short_code)")
        .eq("owner_id", ownerId).is("delivered_at", null).order("created_at").limit(10);
      return (data ?? []).map((n: any) => ({
        id: n.id, kind: n.kind, check_in: n.check_in, check_out: n.check_out,
        apartment_name: n.apartments?.name ?? "", short_code: n.apartments?.short_code ?? null,
      }));
    },
    async markDelivered(ids) {
      await sb.from("owner_notifications").update({ delivered_at: new Date().toISOString() }).in("id", ids);
    },
    async setNights(apartmentId, nights, blocked) {
      let changed = 0;
      for (const n of nights) {
        const ok = blocked ? await closeNight(sb, apartmentId, n, "owner_phone") : await openNight(sb, apartmentId, n);
        if (ok) changed++;
      }
      return changed;
    },
    today: () => nowInJerusalem().slice(0, 10),
  };
}

export function mainDeps(sb: SupabaseClient): MainDeps {
  return {
    async settings() {
      const { data } = await sb.from("settings").select("key, value").in("key", ["secretary_phone", "service_phone", "queue_router_id", "music_url", "welcome_audio_url"]);
      const m = Object.fromEntries((data ?? []).map((r) => [r.key, String(r.value ?? "")]));
      return { secretary: m.secretary_phone ?? "", service: m.service_phone ?? "", routerId: m.queue_router_id ?? "", musicUrl: m.music_url ?? "", welcomeAudioUrl: m.welcome_audio_url ?? "" };
    },
    async latestBooking(phone) {
      if (phone.length < 9) return null;
      const { data: c } = await sb.from("customers").select("id").eq("phone", phone).maybeSingle();
      if (!c) return null;
      const { data } = await sb.from("bookings").select("check_in, check_out, status, apartments(name)")
        .eq("customer_id", c.id).in("status", ["confirmed", "hold"]).order("check_in", { ascending: false }).limit(1).maybeSingle();
      return data ? { apartment_name: (data as any).apartments?.name ?? "", check_in: data.check_in, check_out: data.check_out, status: data.status } : null;
    },
    async bookingsByPhone(phone) {
      if (phone.length < 9) return [];
      const { data: c } = await sb.from("customers").select("id").eq("phone", phone).maybeSingle();
      if (!c) return [];
      const { data } = await sb.from("bookings")
        .select("id, check_in, check_out, status, total_price, deposit_required, apartments(name), payments(amount)")
        .eq("customer_id", c.id).in("status", ["confirmed", "hold"])
        .gte("check_out", nowInJerusalem().slice(0, 10)).order("check_in").limit(3);
      return (data ?? []).map((b: any) => ({
        apartment_name: b.apartments?.name ?? "", check_in: b.check_in, check_out: b.check_out, status: b.status,
        total: b.total_price, deposit_required: b.deposit_required,
        paid: (b.payments ?? []).reduce((a: number, p: any) => a + Number(p.amount), 0),
      }));
    },
  };
}
