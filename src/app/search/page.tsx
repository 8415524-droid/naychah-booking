import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import ApartmentMap from "@/components/ApartmentMap";
import Shell from "@/components/Shell";
import { addDays, depositFor, nightsBetween, nowInJerusalem, quote, type PricingRule } from "@/lib/pricing";
import { fmtDate, upcomingWeekends } from "@/lib/weekends";
import { CONDITION_HE, PERIOD_HE, detailsLine } from "@/lib/labels";
import { AMENITIES, COLUMN_FLAGS, busyNightCount, evaluate, rank, type Evaluation, type SearchQuery, type SortMode } from "@/lib/search-engine";
import { normPhone } from "@/lib/pbx/types";

type SP = Record<string, string | undefined>;

function range(sp: SP): { checkIn: string; checkOut: string } | null {
  if (sp.stay === "custom") return sp.from && sp.to ? { checkIn: sp.from, checkOut: sp.to } : null;
  if (!sp.weekend) return null;
  const sat = sp.weekend;
  if (sp.stay === "fri_sat") return { checkIn: addDays(sat, -1), checkOut: sat };
  if (sp.stay === "thu_night") return { checkIn: addDays(sat, -2), checkOut: addDays(sat, -1) };
  return { checkIn: addDays(sat, -2), checkOut: sat };
}

const flagKey = (key: string) => (COLUMN_FLAGS.some((c) => c.key === key) ? key : `f_${key}`);

function queryFrom(sp: SP): SearchQuery {
  const n = (v?: string) => Number(v) || 0;
  return {
    guests: n(sp.guests), rooms: n(sp.rooms), budget: n(sp.budget), text: sp.q ?? "", maxDistM: n(sp.max_dist),
    showers: n(sp.showers), toilets: n(sp.toilets), sqm: n(sp.sqm), sofaBeds: n(sp.sofa_beds), cribs: n(sp.cribs), parking: n(sp.parking),
    condition: sp.condition ?? "", floor: sp.floor !== undefined && sp.floor !== "" ? Number(sp.floor) : null,
    flags: [...AMENITIES, ...COLUMN_FLAGS].map((f) => f.key).filter((k) => sp[flagKey(k)]),
  };
}

function Tags({ ev }: { ev: Evaluation }) {
  return (
    <p className="tags">
      {ev.oks.map((t, i) => <span key={`o${i}`} className="tag ok">✓ {t}</span>)}
      {ev.gaps.map((g, i) => <span key={`g${i}`} className={`tag ${g.level === "bad" ? "bad" : "gap"}`}>{g.level === "bad" ? "✕" : "⚠"} {g.t}</span>)}
    </p>
  );
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
    p_name: String(fd.get("name") || "").trim(), p_phone: normPhone(String(fd.get("phone") || "")),
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
  const query = queryFrom(sp);
  const guests = query.guests;
  const sort: SortMode = sp.sort === "price" || sp.sort === "distance" ? sp.sort : "best";
  const back = new URLSearchParams(Object.entries(sp).filter(([k, v]) => k !== "err" && v) as [string, string][]).toString();

  type Row = { apt: any; total: number | null; early: boolean; deposit: number; period: string; ev: Evaluation };
  let exact: Row[] = [];
  let near: Row[] = [];
  let skipped: { name: string; reason: string }[] = [];
  if (r && r.checkOut > r.checkIn) {
    const nights = nightsBetween(r.checkIn, r.checkOut);
    const { data: apts } = await supabase.from("apartments")
      .select("id, name, beds, rooms, features, amenities, sofa_beds, cribs, parking_spots, has_yard, has_trampoline, has_swing, has_parents_unit, living_room_sqm, condition, floor, showers, toilets, address, distance_from_tomb_m, notes, early_cutoff_dow, early_cutoff_time, single_night_opens_dow, single_night_opens_time, owners(name), pricing_rules(*)")
      .eq("active", true);
    const ids = (apts ?? []).map((a) => a.id);
    const [{ data: bks }, { data: blks }] = await Promise.all([
      supabase.from("bookings").select("apartment_id, status, hold_expires_at, check_in, check_out")
        .in("apartment_id", ids).in("status", ["hold", "confirmed"]).lt("check_in", r.checkOut).gt("check_out", r.checkIn),
      supabase.from("blocks").select("apartment_id, date_from, date_to").in("apartment_id", ids).lt("date_from", r.checkOut).gt("date_to", r.checkIn),
    ]);
    const nowIso = new Date().toISOString();
    const busyBy = new Map<string, { from: string; to: string }[]>();
    const addBusy = (id: string, from: string, to: string) => busyBy.set(id, [...(busyBy.get(id) ?? []), { from, to }]);
    for (const b of blks ?? []) addBusy(b.apartment_id, b.date_from, b.date_to);
    for (const b of bks ?? []) if (b.status === "confirmed" || (b.hold_expires_at && b.hold_expires_at > nowIso)) addBusy(b.apartment_id, b.check_in, b.check_out);

    const rows: Row[] = [];
    for (const a of apts ?? []) {
      const busyNights = busyNightCount(r.checkIn, r.checkOut, busyBy.get(a.id) ?? []);
      if (busyNights >= nights) continue;
      const q = quote(r.checkIn, r.checkOut, a, a.pricing_rules as PricingRule[], now);
      if (!q.ok) { skipped.push({ name: a.name, reason: q.reason }); continue; }
      const total = q.total;
      rows.push({ apt: a, total, early: q.early, deposit: depositFor(total), period: PERIOD_HE[q.period], ev: evaluate(a, query, { nights, busyNights, total }) });
    }
    ({ exact, near } = rank(rows, guests, sort));
  }

  const ResultCard = ({ row: { apt, total, early, deposit, period, ev } }: { row: Row }) => (
    <div className={`card${ev.exact ? "" : " near"}`}>
      <div className="row">
        <h2 style={{ margin: 0 }}>{apt.name}</h2>
        <div><strong>{total?.toLocaleString()} ₪</strong> <span className="muted">· {period} · {early ? "מחיר מוזל" : "מחיר רגיל"}</span></div>
      </div>
      <p>{apt.beds} מיטות · {apt.rooms ?? "?"} חדרים{apt.distance_from_tomb_m != null && ` · ${apt.distance_from_tomb_m} מ' מהציון`} · {apt.owners?.name}</p>
      <Tags ev={ev} />
      {detailsLine(apt) && <p className="muted">{detailsLine(apt)}</p>}
      {apt.features?.length > 0 && <p className="muted">{apt.features.join(" · ")}</p>}
      {apt.notes && <p className="muted">{apt.notes}</p>}
      <ApartmentMap address={apt.address} name={apt.name} />
      {ev.partial ? <p className="muted">תפוסה חלקית, אי אפשר להזמין בתאריכים אלה</p> : (
        <form action={closeBooking}>
          <input type="hidden" name="apartment_id" value={apt.id} />
          <input type="hidden" name="check_in" value={r!.checkIn} />
          <input type="hidden" name="check_out" value={r!.checkOut} />
          <input type="hidden" name="guests" value={sp.guests ?? ""} />
          <input type="hidden" name="back" value={back} />
          <div className="grid2">
            <div><label>שם הלקוח</label><input name="name" required /></div>
            <div><label>טלפון</label><input name="phone" inputMode="tel" required /></div>
          </div>
          <button className="primary">{ev.exact ? "סגור הזמנה" : "סגור הזמנה למרות הפערים"} · מקדמה {deposit.toLocaleString()} ₪</button>
        </form>
      )}
    </div>
  );

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
          <div><label>חדרים (לפחות)</label><input type="number" name="rooms" min={0} defaultValue={sp.rooms} /></div>
          <div><label>חיפוש חופשי (שם / אזור / הערות)</label><input name="q" defaultValue={sp.q} /></div>
          <div><label>מרחק מקסימלי מהציון (מטרים)</label><input type="number" name="max_dist" min={0} defaultValue={sp.max_dist} /></div>
          <div>
            <label>מיון</label>
            <select name="sort" defaultValue={sort}>
              <option value="best">הכי מתאימה</option>
              <option value="price">הכי זולה</option>
              <option value="distance">הכי קרובה לציון</option>
            </select>
          </div>
          <div><label>תקציב מקסימלי (₪)</label><input type="number" name="budget" min={0} defaultValue={sp.budget} /></div>
          <div>
            <label>מצב הדירה</label>
            <select name="condition" defaultValue={sp.condition ?? ""}>
              <option value="">הכול</option>
              {Object.entries(CONDITION_HE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div><label>קומה (0 = קרקע)</label><input type="number" name="floor" defaultValue={sp.floor} /></div>
          <div><label>מקלחות (לפחות)</label><input type="number" name="showers" min={0} defaultValue={sp.showers} /></div>
          <div><label>שירותים (לפחות)</label><input type="number" name="toilets" min={0} defaultValue={sp.toilets} /></div>
          <div><label>סלון (מ"ר לפחות)</label><input type="number" name="sqm" min={0} defaultValue={sp.sqm} /></div>
          <div><label>ספות נפתחות (לפחות)</label><input type="number" name="sofa_beds" min={0} defaultValue={sp.sofa_beds} /></div>
          <div><label>מיטות תינוק (לפחות)</label><input type="number" name="cribs" min={0} defaultValue={sp.cribs} /></div>
          <div><label>חניות (לפחות)</label><input type="number" name="parking" min={0} defaultValue={sp.parking} /></div>
        </div>
        <details open={query.flags.length > 0}>
          <summary>מאפיינים נדרשים</summary>
          <div className="checks">
            {[...COLUMN_FLAGS, ...AMENITIES].map((f) => (
              <label key={f.key}><input type="checkbox" name={flagKey(f.key)} value="1" defaultChecked={query.flags.includes(f.key)} /> {f.label}</label>
            ))}
          </div>
        </details>
        <p className="muted">דירה שלא עונה על דרישה לא נעלמת: היא מוצגת עם סימון ⚠ מה חסר בה, ומדורגת אחרי המתאימות לגמרי.</p>
        <button className="primary">חיפוש</button>
      </form>

      {sp.err && <p className="err">{sp.err}</p>}

      {r && (
        <>
          <p className="muted">{fmtDate(r.checkIn)} עד {fmtDate(r.checkOut)} · {exact.length} מתאימות לגמרי{near.length > 0 && ` · ${near.length} כמעט מתאימות`}</p>
          {exact.length === 0 && near.length > 0 && <p className="muted">אין דירה שעונה על כל הדרישות. אלה הקרובות ביותר:</p>}
          {exact.length === 0 && near.length === 0 && <p className="muted">לא נמצאה דירה קרובה. אפשר להרחיב תאריכים או לוותר על חלק מהדרישות.</p>}
          {exact.map((row) => <ResultCard key={row.apt.id} row={row} />)}
          {near.length > 0 && exact.length > 0 && <h2>כמעט מתאימות</h2>}
          {near.map((row) => <ResultCard key={row.apt.id} row={row} />)}
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
