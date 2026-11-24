import { getSession } from "@/lib/auth";
import Shell from "@/components/Shell";
import { forecastWeekend } from "@/lib/forecast";
import { addDays, nowInJerusalem } from "@/lib/pricing";
import { fmtDate, upcomingWeekends } from "@/lib/weekends";

export default async function Forecast() {
  const { supabase, role, name } = await getSession(["admin", "agent"]);
  const today = nowInJerusalem().slice(0, 10);
  const weekends = upcomingWeekends(today, 8);
  const from = addDays(weekends[0].saturday, -1), to = addDays(weekends[weekends.length - 1].saturday, 1);
  const [{ data: apts }, { data: bookings }, { data: blocks }] = await Promise.all([
    supabase.from("apartments").select("id, name").eq("active", true).order("name"),
    supabase.from("bookings").select("apartment_id, check_in, check_out, status, total_price, deposit_required").in("status", ["hold", "confirmed"]).lt("check_in", to).gt("check_out", from),
    supabase.from("blocks").select("apartment_id, date_from, date_to").lt("date_from", to).gt("date_to", from),
  ]);
  const rows = weekends.map((w) => forecastWeekend(w.saturday, w.parsha, apts ?? [], bookings ?? [], blocks ?? []));
  const recs = rows.slice(0, 3).filter((r) => r.total && r.occupancyPct < 50);
  return (
    <Shell role={role} name={name}>
      <h1>תחזית שבתות</h1>
      <div className="card">
        <p className="muted">תפוסה והכנסה צפויה ל-8 השבתות הקרובות (לילות שישי ושבת). הכנסה = סכום ההזמנות הסגורות, מקדמות = חלקנו.</p>
        <table>
          <thead><tr><th>שבת</th><th>תפוסה</th><th>סגורות</th><th>ממתינות</th><th>חסומות</th><th>פנויות</th><th>הכנסה</th><th>מקדמות</th></tr></thead>
          <tbody>{rows.map((r) => (
            <tr key={r.saturday}>
              <td>{r.parsha} · {fmtDate(r.saturday)}</td>
              <td><strong className={r.occupancyPct < 50 ? "err" : "ok"}>{r.occupancyPct}%</strong></td>
              <td>{r.booked}</td><td>{r.held}</td><td>{r.blocked}</td><td>{r.free}</td>
              <td>{r.revenue.toLocaleString()} ₪</td><td>{r.deposits.toLocaleString()} ₪</td>
            </tr>
          ))}</tbody>
        </table>
      </div>
      <div className="card">
        <h2>המלצות</h2>
        {recs.length === 0 && <p className="muted">השבתות הקרובות מלאות מספיק. אין המלצות.</p>}
        {recs.map((r) => <p key={r.saturday}>שבת {r.parsha} ({fmtDate(r.saturday)}): תפוסה {r.occupancyPct}%. כדאי לפרסם או להציע הנחה ל-{r.free} דירות פנויות{r.freeNames.length ? `: ${r.freeNames.slice(0, 8).join(", ")}` : ""}.</p>)}
      </div>
    </Shell>
  );
}
