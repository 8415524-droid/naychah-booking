import type { SupabaseClient } from "@supabase/supabase-js";
import { PERIOD_HE } from "@/lib/labels";
import { depositFor, nightsBetween, quote, addDays, type PricingRule } from "@/lib/pricing";
import { AMENITIES, COLUMN_FLAGS, busyNightCount, evaluate, findSplits, rank, type Evaluation, type SearchQuery, type SortMode, type SplitOption } from "@/lib/search-engine";
import { normPhone } from "@/lib/pbx/types";


export const flagKey = (key: string) => (COLUMN_FLAGS.some((c) => c.key === key) ? key : `f_${key}`);

export function queryFrom(sp: Record<string, string | undefined>): SearchQuery {
  const n = (v?: string) => Number(v) || 0;
  return {
    guests: n(sp.guests), rooms: n(sp.rooms), budget: n(sp.budget), text: sp.q ?? "", maxDistM: n(sp.max_dist),
    showers: n(sp.showers), toilets: n(sp.toilets), sqm: n(sp.sqm), sofaBeds: n(sp.sofa_beds), cribs: n(sp.cribs), parking: n(sp.parking),
    condition: sp.condition ?? "", floor: sp.floor !== undefined && sp.floor !== "" ? Number(sp.floor) : null,
    flags: [...AMENITIES, ...COLUMN_FLAGS].map((f) => f.key).filter((k) => sp[flagKey(k)]),
    must: Object.keys(sp).filter((k) => k.startsWith("must_") && sp[k]).map((k) => k.slice(5)),
  };
}

export type Row = { apt: any; total: number | null; early: boolean; deposit: number; period: string; ev: Evaluation; notes: string[] };
export interface SearchOutcome {
  exact: Row[]; near: Row[]; splits: SplitOption[];
  held: { name: string; until: string }[];             // פנויות אבל שמורות כרגע לטלפנית אחרת
  skipped: { name: string; reason: string }[];
  returning: { name: string; bookings: number } | null;
}

const SELECT = "id, name, beds, rooms, features, amenities, sofa_beds, cribs, parking_spots, has_yard, has_trampoline, has_swing, has_parents_unit, living_room_sqm, condition, floor, showers, toilets, address, distance_from_tomb_m, notes, early_cutoff_dow, early_cutoff_time, single_night_opens_dow, single_night_opens_time, owners(name), pricing_rules(*)";

export function stayRange(sp: Record<string, string | undefined>): { checkIn: string; checkOut: string } | null {
  if (sp.stay === "custom") return sp.from && sp.to ? { checkIn: sp.from, checkOut: sp.to } : null;
  if (!sp.weekend) return null;
  const sat = sp.weekend;
  if (sp.stay === "fri_sat") return { checkIn: addDays(sat, -1), checkOut: sat };
  if (sp.stay === "thu_night") return { checkIn: addDays(sat, -2), checkOut: addDays(sat, -1) };
  return { checkIn: addDays(sat, -2), checkOut: sat };
}

export async function runSearch(
  supabase: SupabaseClient, query: SearchQuery, r: { checkIn: string; checkOut: string },
  sort: SortMode, now: string, custPhone?: string,
): Promise<SearchOutcome> {
  const nights = nightsBetween(r.checkIn, r.checkOut);
  const { data: apts } = await supabase.from("apartments").select(SELECT).eq("active", true);
  const ids = (apts ?? []).map((a: any) => a.id);
  const yearAgo = addDays(now.slice(0, 10), -365);
  const phone = custPhone ? normPhone(custPhone) : "";
  const [{ data: bks }, { data: blks }, { data: past }, { data: cust }] = await Promise.all([
    supabase.from("bookings").select("apartment_id, status, hold_expires_at, check_in, check_out")
      .in("apartment_id", ids).in("status", ["hold", "confirmed"]).lt("check_in", r.checkOut).gt("check_out", r.checkIn),
    supabase.from("blocks").select("apartment_id, date_from, date_to").in("apartment_id", ids).lt("date_from", r.checkOut).gt("date_to", r.checkIn),
    supabase.from("bookings").select("apartment_id").eq("status", "confirmed").gte("check_in", yearAgo),
    phone ? supabase.from("customers").select("id, full_name").eq("phone", phone).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const nowIso = new Date().toISOString();

  // הזמנות קודמות של הלקוח (אם הוקלד טלפון)
  const mine = new Map<string, number>();
  let returning: SearchOutcome["returning"] = null;
  if (cust) {
    const { data: his } = await supabase.from("bookings").select("apartment_id").eq("customer_id", (cust as any).id).eq("status", "confirmed");
    for (const b of his ?? []) mine.set(b.apartment_id, (mine.get(b.apartment_id) ?? 0) + 1);
    returning = { name: (cust as any).full_name, bookings: (his ?? []).length };
  }
  // פופולריות: כמה הזמנות נסגרו בשנה האחרונה
  const pop = new Map<string, number>();
  for (const b of past ?? []) pop.set(b.apartment_id, (pop.get(b.apartment_id) ?? 0) + 1);
  const topPop = Math.max(0, ...pop.values());

  const busyBy = new Map<string, { from: string; to: string }[]>();
  const holdBy = new Map<string, { from: string; to: string }[]>();
  const holdUntil = new Map<string, string>();
  const add = (m: typeof busyBy, id: string, from: string, to: string) => m.set(id, [...(m.get(id) ?? []), { from, to }]);
  for (const b of blks ?? []) add(busyBy, b.apartment_id, b.date_from, b.date_to);
  for (const b of bks ?? []) {
    if (b.status === "confirmed") add(busyBy, b.apartment_id, b.check_in, b.check_out);
    else if (b.hold_expires_at && b.hold_expires_at > nowIso) {
      add(holdBy, b.apartment_id, b.check_in, b.check_out);
      if (!holdUntil.has(b.apartment_id) || b.hold_expires_at < holdUntil.get(b.apartment_id)!) holdUntil.set(b.apartment_id, b.hold_expires_at);
    }
  }

  const rows: Row[] = [];
  const skipped: SearchOutcome["skipped"] = [];
  const held: SearchOutcome["held"] = [];
  const boost = new Map<string, number>();
  for (const a of apts ?? []) {
    const hard = busyBy.get(a.id) ?? [];
    const withHolds = [...hard, ...(holdBy.get(a.id) ?? [])];
    const busyNights = busyNightCount(r.checkIn, r.checkOut, withHolds);
    if (busyNights >= nights) {
      if (busyNightCount(r.checkIn, r.checkOut, hard) === 0) held.push({ name: a.name, until: holdUntil.get(a.id)! });
      continue;
    }
    const q = quote(r.checkIn, r.checkOut, a, a.pricing_rules as PricingRule[], now);
    if (!q.ok) { skipped.push({ name: a.name, reason: q.reason }); continue; }
    const notes: string[] = [];
    let b = 0;
    if (mine.has(a.id)) { notes.push(`הלקוח כבר הזמין כאן (${mine.get(a.id)} פעמים)`); b -= 0.5; }
    const p = pop.get(a.id) ?? 0;
    if (p >= 3 && p === topPop) notes.push("מהנסגרות ביותר בשנה האחרונה");
    b -= Math.min(p, 10) * 0.04;
    boost.set(a.id, b);
    rows.push({ apt: a, total: q.total, early: q.early, deposit: depositFor(q.total), period: PERIOD_HE[q.period], ev: evaluate(a, query, { nights, busyNights, total: q.total }), notes });
  }
  const { exact, near } = rank(rows, query.guests, sort, boost);
  const splits = exact.length === 0 ? findSplits(rows, query.guests) : [];
  return { exact, near, splits, held, skipped, returning };
}
