import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import Shell from "@/components/Shell";
import { addDays, depositFor, nowInJerusalem, quote, type PricingRule } from "@/lib/pricing";
import { fmtDate, upcomingWeekends } from "@/lib/weekends";
import { PERIOD_HE } from "@/lib/labels";

type SP = { weekend?: string; stay?: string; from?: string; to?: string; guests?: string; budget?: string; err?: string };

function range(sp: SP): { checkIn: string; checkOut: string } | null {
  if (sp.stay === "custom") return sp.from && sp.to ? { checkIn: sp.from, checkOut: sp.to } : null;
  if (!sp.weekend) return null;
  const sat = sp.weekend;
  if (sp.stay === "fri_sat") return { checkIn: addDays(sat, -1), checkOut: sat };
  if (sp.stay === "thu_night") return { checkIn: addDays(sat, -2), checkOut: addDays(sat, -1) };
  return { checkIn: addDays(sat, -2), checkOut: sat };
}

async function closeBooking(fd: FormData) {
  "use server";
  const { supabase } = await getSession(["admin", "agent"]);
  const apartment = String(fd.get("apartment_id"));
  const checkIn = String(fd.get("check_in"));
  const checkOut = String(fd.get("check_out"));
  const back = String(fd.get("back"));
  const fail = (m: string) => redirect(`/search?${back}&err=${encodeURIComponent(m)}`);

  const { data: apt } = await supabase.from("apartments")
    .select("id, active, early_cutoff_dow, early_cutoff_time, single_night_opens_dow, single_night_opens_time, pricing_rules(*)")
    .eq("id", apartment).single();
  if (!apt || !apt.active) return fail("הדירה לא זמינה");
  // המחיר מחושב מחדש בשרת, לא מהדפדפן
  const q = quote(checkIn, checkOut, apt, apt.pricing_rules as PricingRule[], nowInJerusalem());
  if (!q.ok) return fail(q.reason);

  const { data, error } = await supabase.rpc("create_hold", {
    p_apartment: apartment, p_check_in: checkIn, p_check_out: checkOut,
    p_guests: Number(fd.get("guests")) || null,
    p_name: String(fd.get("name") || "").trim(), p_phone: String(fd.get("phone") || "").trim(),
    p_total: q.total,
  });
  if (error) return fail(error.code === "23P01" ? "הדירה כבר נתפסה בתאריכים אלה" : "שגיאה בתפיסת הדירה");
  redirect(`/bookings/${data}`);
}

export default async function Search({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const { supabase, role, name } = await getSession(["admin", "agent"]);
  const now = nowInJerusalem();
  const weekends = upcomingWeekends(now.slice(0, 10));
  const r = range(sp);
  const guests = Number(sp.guests) || 0;
  const budget = Number(sp.budget) || 0;
  const back = new URLSearchParams(Object.entries(sp).filter(([k, v]) => k !== "err" && v) as [string, string][]).toString();

  let results: { apt: any; total: number; early: boolean; deposit: number; period: string }[] = [];
  let skipped: { name: string; reason: string }[] = [];
  if (r && r.checkOut > r.checkIn) {
    const { data: apts } = await supabase.from("apartments")
      .select("id, name, beds, rooms, features, address, distance_from_tomb_m, notes, early_cutoff_dow, early_cutoff_time, single_night_opens_dow, single_night_opens_time, owners(name), pricing_rules(*)")
      .eq("active", true).gte("beds", guests || 1);
    const ids = (apts ?? []).map((a) => a.id);
    const [{ data: bks }, { data: blks }] = await Promise.all([
      supabase.from("bookings").select("apartment_id, status, hold_expires_at")
        .in("apartment_id", ids).in("status", ["hold", "confirmed"]).lt("check_in", r.checkOut).gt("check_out", r.checkIn),
      supabase.from("blocks").select("apartment_id").in("apartment_id", ids).lt("date_from", r.checkOut).gt("date_to", r.checkIn),
    ]);
    const nowIso = new Date().toISOString();
    const busy = new Set<string>([
      ...(blks ?? []).map((b) => b.apartment_id),
      ...(bks ?? []).filter((b) => b.status === "confirmed" || (b.hold_expires_at && b.hold_expires_at > nowIso)).map((b) => b.apartment_id),
    ]);
    for (const a of apts ?? []) {
      if (busy.has(a.id)) continue;
      const q = quote(r.checkIn, r.checkOut, a, a.pricing_rules as PricingRule[], now);
      if (!q.ok) { skipped.push({ name: a.name, reason: q.reason }); continue; }
      if (budget && q.total > budget) continue;
      results.push({ apt: a, total: q.total, early: q.early, deposit: depositFor(q.total), period: PERIOD_HE[q.period] });
    }
    // התאמת מיטות הדוקה ראשונה, אחר כך מחיר
    results.sort((x, y) => (x.apt.beds - guests) - (y.apt.beds - guests) || x.total - y.total);
  }

  return (
    <Shell role={role} name={name}>
      <h1>חיפוש דירה</h1>
      <form className="card" method="get">
        <div className="grid2">
          <div>
            <label>שבת / פרשה</label>
            <select name="weekend" defaultValue={sp.weekend ?? ""}>
              <option value="">בחר…</option>
              {weekends.map((w) => <option key={w.saturday} value={w.saturday}>{w.parsha} · {fmtDate(w.saturday)}</option>)}
            </select>
          </div>
          <div>
            <label>סוג שהייה</label>
            <select name="stay" defaultValue={sp.stay ?? "thu_sat"}>
              <option value="thu_sat">חמישי עד שבת</option>
              <option value="fri_sat">שישי עד שבת</option>
              <option value="thu_night">לילה בודד (חמישי)</option>
              <option value="custom">תאריכים אחרים</option>
            </select>
          </div>
          <div><label>כניסה (לתאריכים אחרים)</label><input type="date" name="from" defaultValue={sp.from} /></div>
          <div><label>יציאה</label><input type="date" name="to" defaultValue={sp.to} /></div>
          <div><label>מספר אנשים / מיטות</label><input type="number" name="guests" min={1} defaultValue={sp.guests} /></div>
          <div><label>תקציב מקסימלי (₪)</label><input type="number" name="budget" min={0} defaultValue={sp.budget} /></div>
        </div>
        <button className="primary">חיפוש</button>
      </form>

      {sp.err && <p className="err">{sp.err}</p>}

      {r && (
        <>
          <p className="muted">{fmtDate(r.checkIn)} עד {fmtDate(r.checkOut)} · נמצאו {results.length} דירות פנויות</p>
          {results.map(({ apt, total, early, deposit, period }) => (
            <div key={apt.id} className="card">
              <div className="row">
                <h2 style={{ margin: 0 }}>{apt.name}</h2>
                <div><strong>{total.toLocaleString()} ₪</strong> <span className="muted">· {period} · {early ? "מחיר מוזל" : "מחיר רגיל"}</span></div>
              </div>
              <p>{apt.beds} מיטות · {apt.rooms ?? "?"} חדרים{apt.distance_from_tomb_m != null && ` · ${apt.distance_from_tomb_m} מ' מהציון`} · {apt.owners?.name}</p>
              {apt.features?.length > 0 && <p className="muted">{apt.features.join(" · ")}</p>}
              {apt.notes && <p className="muted">{apt.notes}</p>}
              <form action={closeBooking}>
                <input type="hidden" name="apartment_id" value={apt.id} />
                <input type="hidden" name="check_in" value={r.checkIn} />
                <input type="hidden" name="check_out" value={r.checkOut} />
                <input type="hidden" name="guests" value={sp.guests ?? ""} />
                <input type="hidden" name="back" value={back} />
                <div className="grid2">
                  <div><label>שם הלקוח</label><input name="name" required /></div>
                  <div><label>טלפון</label><input name="phone" inputMode="tel" required /></div>
                </div>
                <button className="primary">סגור הזמנה · מקדמה {deposit.toLocaleString()} ₪</button>
              </form>
            </div>
          ))}
          {skipped.length > 0 && (
            <details className="card"><summary>דירות פנויות שלא ניתן לתמחר ({skipped.length})</summary>
              <ul>{skipped.map((s, i) => <li key={i}>{s.name}: {s.reason}</li>)}</ul>
            </details>
          )}
        </>
      )}
    </Shell>
  );
}
