import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { walkLabel } from "@/lib/geo";
import ApartmentMap from "@/components/ApartmentMap";
import Shell from "@/components/Shell";
import { depositFor, nowInJerusalem, quote, type PricingRule } from "@/lib/pricing";
import { fmtDate, upcomingWeekends } from "@/lib/weekends";
import { CONDITION_HE, PERIOD_HE, detailsLine } from "@/lib/labels";
import { flagKey, queryFrom, runSearch, stayRange, type Row, type SearchOutcome } from "@/lib/search-run";
import { AMENITIES, COLUMN_FLAGS, explain, type Evaluation, type SortMode } from "@/lib/search-engine";
import { normPhone } from "@/lib/pbx/types";

type SP = Record<string, string | undefined>;

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

async function addToWaitlist(fd: FormData) {
  "use server";
  const { supabase } = await getSession(["admin", "agent"]);
  const back = String(fd.get("back"));
  const sp = Object.fromEntries(new URLSearchParams(back)) as Record<string, string>;
  const r = stayRange(sp);
  const name = String(fd.get("name") || "").trim();
  const phone = normPhone(String(fd.get("phone") || ""));
  if (!r || !name || !phone) redirect(`/search?${back}&err=${encodeURIComponent("חסרים שם או טלפון לרשימת ההמתנה")}`);
  const { error } = await supabase.from("search_waitlist").insert({
    customer_name: name, customer_phone: phone, params: back, check_in: r.checkIn, check_out: r.checkOut, guests: Number(sp.guests) || null,
  });
  if (error) redirect(`/search?${back}&err=${encodeURIComponent("שמירה ברשימת ההמתנה נכשלה")}`);
  redirect("/waitlist");
}

export default async function Search({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const { supabase, role, name } = await getSession(["admin", "agent"]);
  const now = nowInJerusalem();
  const weekends = upcomingWeekends(now.slice(0, 10));
  const r = stayRange(sp);
  const query = queryFrom(sp);
  const guests = query.guests;
  const sort: SortMode = sp.sort === "price" || sp.sort === "near" ? sp.sort : "best";
  const MAIN = ["weekend", "stay", "guests", "rooms", "budget", "maxwalk", "q", "sort", "err"];
  const moreCount = Object.entries(sp).filter(([k, v]) => v && !MAIN.includes(k)).length;
  const back = new URLSearchParams(Object.entries(sp).filter(([k, v]) => k !== "err" && v) as [string, string][]).toString();

  // מספיק למלא שדה אחד כלשהו: בלי תאריכים מדרגים לפי שאר הדרישות בלבד
  const dated = !!r && r.checkOut > r.checkIn;
  const filled = Object.entries(sp).some(([k, v]) => v && !["err", "stay", "sort"].includes(k));
  let out: SearchOutcome | null = null;
  if (filled) out = await runSearch(supabase, query, dated ? r : null, sort, now, sp.cust_phone);
  const exact = out?.exact ?? [], near = out?.near ?? [];

  const ResultCard = ({ row: { apt, total, early, deposit, period, ev, notes } }: { row: Row }) => (
    <div className={`card${ev.exact ? "" : " near"}`}>
      <div className="row">
        <h2 style={{ margin: 0 }}>{apt.name}</h2>
        <div>{total != null ? <><strong>{total.toLocaleString()} ₪</strong> <span className="muted">· {period} · {early ? "מחיר מוזל" : "מחיר רגיל"}</span></> : dated && <span className="muted">מחיר לפי בירור</span>}</div>
      </div>
      <p>{apt.beds} מיטות · {apt.rooms ?? "?"} חדרים{apt.walk_minutes != null ? ` · ${walkLabel(apt.walk_minutes)}` : apt.distance_from_tomb_m != null && ` · ${apt.distance_from_tomb_m} מ' מהציון`} · {apt.owners?.name}</p>
      <p><strong>{explain(apt, ev)}</strong></p>
      <Tags ev={ev} />
      {notes.map((t, i) => <span key={i} className="tag ok">★ {t}</span>)}
      {detailsLine(apt) && <p className="muted">{detailsLine(apt)}</p>}
      {apt.features?.length > 0 && <p className="muted">{apt.features.join(" · ")}</p>}
      {apt.notes && <p className="muted">{apt.notes}</p>}
      <ApartmentMap address={apt.address} name={apt.name} lat={apt.lat} lng={apt.lng} />
      {!dated ? null : ev.partial ? <p className="muted">תפוסה חלקית, אי אפשר להזמין בתאריכים אלה</p> : total == null ? <p className="muted">אי אפשר לסגור מכאן: אין מחיר מוגדר לשהייה הזו, יש לברר מול בעל הדירה</p> : (
        <form action={closeBooking}>
          <input type="hidden" name="apartment_id" value={apt.id} />
          <input type="hidden" name="check_in" value={r!.checkIn} />
          <input type="hidden" name="check_out" value={r!.checkOut} />
          <input type="hidden" name="guests" value={sp.guests ?? ""} />
          <input type="hidden" name="back" value={back} />
          <div className="grid2">
            <div><label>שם הלקוח</label><input name="name" defaultValue={out?.returning?.name ?? ""} required /></div>
            <div><label>טלפון</label><input name="phone" inputMode="tel" defaultValue={sp.cust_phone ?? ""} required /></div>
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
        <p className="muted">אפשר למלא רק חלק מהשדות. כל מה שלא מולא לא נדרש, ודירות שלא עונות על הכול מוצגות עם סימון מה חסר.</p>
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
          <div><label>מספר אנשים / מיטות</label><input type="number" name="guests" min={1} defaultValue={sp.guests} /></div>
          <div><label>חדרים (לפחות)</label><input type="number" name="rooms" min={0} defaultValue={sp.rooms} /></div>
          <div><label>תקציב מקסימלי (₪)</label><input type="number" name="budget" min={0} defaultValue={sp.budget} /></div>
          <div><label>עד כמה דקות הליכה מהציון</label><input type="number" name="maxwalk" min={1} defaultValue={sp.maxwalk} /></div>
          <div><label>חיפוש חופשי (שם / אזור / הערות)</label><input name="q" defaultValue={sp.q} /></div>
          <div>
            <label>מיון</label>
            <select name="sort" defaultValue={sort}>
              <option value="best">הכי מתאימה</option>
              <option value="price">הכי זולה</option>
              <option value="near">הכי קרובה לציון</option>
            </select>
          </div>
        </div>
        <details open={moreCount > 0}>
          <summary>עוד אפשרויות{moreCount > 0 ? ` (${moreCount} מולאו)` : ""}</summary>
          <div className="grid2">
            <div><label>כניסה (לתאריכים אחרים)</label><input type="date" name="from" defaultValue={sp.from} /></div>
            <div><label>יציאה</label><input type="date" name="to" defaultValue={sp.to} /></div>
            <div><label>טלפון הלקוח (לזיהוי לקוח חוזר)</label><input name="cust_phone" inputMode="tel" defaultValue={sp.cust_phone} /></div>
            <div><label>מרחק מקסימלי מהציון (מטרים)</label><input type="number" name="max_dist" min={0} defaultValue={sp.max_dist} /></div>
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
          <h3>מאפיינים נדרשים</h3>
          <div className="checks">
            {[...COLUMN_FLAGS, ...AMENITIES].map((f) => (
              <label key={f.key}><input type="checkbox" name={flagKey(f.key)} value="1" defaultChecked={query.flags.includes(f.key)} /> {f.label}</label>
            ))}
          </div>
          <h3>מה חובה (ולא רק רצוי)</h3>
          <div className="checks">
            {[{ key: "guests", label: "מספר המיטות" }, { key: "rooms", label: "חדרים" }, { key: "budget", label: "התקציב" }, { key: "dist", label: "המרחק מהציון" }, { key: "walk", label: "זמן ההליכה" }, ...COLUMN_FLAGS, ...AMENITIES].map((f) => (
              <label key={f.key}><input type="checkbox" name={`must_${f.key}`} value="1" defaultChecked={query.must.includes(f.key)} /> {f.label}</label>
            ))}
          </div>
        </details>
        <button className="primary">חיפוש</button>
      </form>

      {sp.err && <p className="err">{sp.err}</p>}

      {out && (
        <>
          <p className="muted">{dated ? `${fmtDate(r!.checkIn)} עד ${fmtDate(r!.checkOut)}` : "בלי תאריכים: הדירוג לפי שאר הדרישות בלבד"}{out?.returning && ` · לקוח חוזר: ${out.returning.name} (${out.returning.bookings} הזמנות קודמות)`} · {exact.length} מתאימות לגמרי{near.length > 0 && ` · ${near.length} כמעט מתאימות`}</p>
          {exact.length === 0 && near.length > 0 && <p className="muted">אין דירה שעונה על כל הדרישות. אלה הקרובות ביותר:</p>}
          {exact.length === 0 && near.length === 0 && <p className="muted">לא נמצאה דירה קרובה. אפשר להרחיב תאריכים או לוותר על חלק מהדרישות.</p>}
          {exact.map((row) => <ResultCard key={row.apt.id} row={row} />)}
          {near.length > 0 && exact.length > 0 && <h2>כמעט מתאימות</h2>}
          {near.map((row) => <ResultCard key={row.apt.id} row={row} />)}
          {(out?.splits.length ?? 0) > 0 && (
            <>
              <h2>אין דירה אחת, אפשר לפצל בין שתיים קרובות</h2>
              {out!.splits.map((sp2, i) => (
                <div key={i} className="card near">
                  <p><strong>{sp2.a.apt.name} + {sp2.b.apt.name}</strong> · {sp2.beds} מיטות יחד · {sp2.total?.toLocaleString()} ₪ · {sp2.gapM} מ' ביניהן</p>
                  <p className="muted">{sp2.a.apt.name}: {sp2.a.apt.beds} מיטות, {sp2.a.apt.distance_from_tomb_m} מ' מהציון · {sp2.b.apt.name}: {sp2.b.apt.beds} מיטות, {sp2.b.apt.distance_from_tomb_m} מ' מהציון</p>
                </div>
              ))}
            </>
          )}
          {(out?.held.length ?? 0) > 0 && (
            <details className="card"><summary>שמורות כרגע לטלפנית אחרת ({out!.held.length})</summary>
              <ul>{out!.held.map((h, i) => <li key={i}>{h.name}: נשמרת עד {new Date(h.until).toLocaleTimeString("he-IL", { timeZone: "Asia/Jerusalem", hour: "2-digit", minute: "2-digit" })}, ואם לא תשולם מקדמה היא תתפנה</li>)}</ul>
            </details>
          )}
          {exact.length === 0 && dated && (
            <form action={addToWaitlist} className="card">
              <h3>לשמור את הבקשה ברשימת המתנה</h3>
              <input type="hidden" name="back" value={back} />
              <div className="grid2">
                <div><label>שם הלקוח</label><input name="name" defaultValue={out?.returning?.name ?? ""} required /></div>
                <div><label>טלפון</label><input name="phone" inputMode="tel" defaultValue={sp.cust_phone ?? ""} required /></div>
              </div>
              <button>הוסף לרשימת המתנה</button>
            </form>
          )}
        </>
      )}
    </Shell>
  );
}
