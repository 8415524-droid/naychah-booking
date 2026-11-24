import { getSession } from "@/lib/auth";
import Shell from "@/components/Shell";
import { nowInJerusalem } from "@/lib/pricing";
import { monthRange, summarize } from "@/lib/reports";
import { fmtDate } from "@/lib/weekends";

const STATUS_HE: Record<string, string> = { hold: "ממתינה למקדמה", confirmed: "סגורה", cancelled: "בוטלה", expired: "פגה" };

// דוח אישי לבעל דירה: ההזמנות וההכנסה של דירותיו בלבד (ה-RLS מסנן). מנהל רואה את כולם.
export default async function MyReport({ searchParams }: { searchParams: Promise<{ m?: string }> }) {
  const sp = await searchParams;
  const { supabase, role, name } = await getSession(["owner", "admin"]);
  const month = /^\d{4}-\d{2}$/.test(sp.m ?? "") ? sp.m! : nowInJerusalem().slice(0, 7);
  const { from, to } = monthRange(month);
  const [{ data: apts }, { data: bookings }] = await Promise.all([
    supabase.from("apartments").select("id, name, owner_id, owners(name)").eq("active", true).order("name"),
    supabase.from("bookings").select("id, apartment_id, check_in, check_out, status, total_price, deposit_required, guests, apartments(name)")
      .lt("check_in", to).gt("check_out", from).order("check_in"),
  ]);
  const s = summarize((apts ?? []).map((a: any) => ({ id: a.id, name: a.name, owner_id: a.owner_id, owner_name: a.owners?.name ?? "" })), bookings ?? [], from, to);
  const list = (bookings ?? []).filter((b) => b.status === "confirmed" || b.status === "hold");
  return (
    <Shell role={role} name={name}>
      <h1>הדוח שלי</h1>
      <form className="card" method="get">
        <label>חודש</label><input type="month" name="m" defaultValue={month} />
        <button className="primary">הצג</button>
      </form>
      <div className="card">
        <h2>סיכום {month}</h2>
        <p>לילות סגורים: <strong>{s.totalNights}</strong> · סכום הזמנות סגורות: <strong>{s.totalRevenue.toLocaleString()} ₪</strong></p>
        <table>
          <thead><tr><th>דירה</th><th>לילות</th><th>תפוסה</th><th>סכום</th></tr></thead>
          <tbody>{s.rows.map((r) => <tr key={r.id}><td>{r.name}</td><td>{r.nights}</td><td>{r.occupancy}%</td><td>{r.revenue.toLocaleString()} ₪</td></tr>)}</tbody>
        </table>
      </div>
      <div className="card">
        <h2>הזמנות בחודש</h2>
        <table>
          <thead><tr><th>דירה</th><th>תאריכים</th><th>אנשים</th><th>סכום</th><th>סטטוס</th></tr></thead>
          <tbody>{list.map((b: any) => (
            <tr key={b.id}><td>{b.apartments?.name}</td><td>{fmtDate(b.check_in)} – {fmtDate(b.check_out)}</td><td>{b.guests ?? ""}</td><td>{b.total_price.toLocaleString()} ₪</td><td>{STATUS_HE[b.status]}</td></tr>
          ))}</tbody>
        </table>
        {list.length === 0 && <p className="muted">אין הזמנות בחודש הזה.</p>}
      </div>
    </Shell>
  );
}
