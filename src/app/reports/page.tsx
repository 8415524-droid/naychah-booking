import { getSession } from "@/lib/auth";
import Shell from "@/components/Shell";
import { nowInJerusalem } from "@/lib/pricing";
import { monthRange, summarize } from "@/lib/reports";

const METHOD_HE: Record<string, string> = { credit: "אשראי", transfer: "העברה", cash: "מזומן", other: "אחר" };

export default async function Reports({ searchParams }: { searchParams: Promise<{ m?: string }> }) {
  const sp = await searchParams;
  const { supabase, role, name } = await getSession(["admin"]);
  const month = /^\d{4}-\d{2}$/.test(sp.m ?? "") ? sp.m! : nowInJerusalem().slice(0, 7);
  const { from, to } = monthRange(month);

  const [{ data: apts }, { data: bookings }, { data: payments }] = await Promise.all([
    supabase.from("apartments").select("id, name, owner_id, owners(name)").eq("active", true).order("name"),
    supabase.from("bookings").select("apartment_id, check_in, check_out, status, total_price").lt("check_in", to).gt("check_out", from),
    supabase.from("payments").select("amount, method").gte("created_at", from + "T00:00:00+02:00").lt("created_at", to + "T00:00:00+02:00"),
  ]);
  const s = summarize((apts ?? []).map((a: any) => ({ id: a.id, name: a.name, owner_id: a.owner_id, owner_name: a.owners?.name ?? "" })), bookings ?? [], from, to);
  const counts = { confirmed: 0, hold: 0, cancelled: 0, expired: 0 } as Record<string, number>;
  (bookings ?? []).forEach((b) => { counts[b.status] = (counts[b.status] ?? 0) + 1; });
  const collected = (payments ?? []).reduce((a, p) => a + p.amount, 0);
  const byMethod = new Map<string, number>();
  (payments ?? []).forEach((p) => byMethod.set(p.method, (byMethod.get(p.method) ?? 0) + p.amount));

  return (
    <Shell role={role} name={name}>
      <h1>דוחות</h1>
      <form className="card" method="get">
        <label>חודש</label>
        <input type="month" name="m" defaultValue={month} />
        <button className="primary">הצג</button>
      </form>
      <div className="card">
        <h2>סיכום {month}</h2>
        <p>הזמנות סגורות: <strong>{counts.confirmed}</strong> · ממתינות למקדמה: {counts.hold} · בוטלו: {counts.cancelled} · פגו: {counts.expired}</p>
        <p>לילות סגורים: <strong>{s.totalNights}</strong> · הכנסה מהזמנות סגורות: <strong>{s.totalRevenue.toLocaleString()} ₪</strong></p>
        <p>מקדמות ותשלומים שנגבו בחודש: <strong>{collected.toLocaleString()} ₪</strong> {[...byMethod].map(([k, v]) => `· ${METHOD_HE[k] ?? k}: ${v.toLocaleString()}`).join(" ")}</p>
      </div>
      <div className="card">
        <h2>לפי בעל דירה</h2>
        <table><thead><tr><th>בעלים</th><th>לילות</th><th>הכנסה</th></tr></thead>
          <tbody>{s.owners.map((o) => <tr key={o.owner}><td>{o.owner}</td><td>{o.nights}</td><td>{o.revenue.toLocaleString()} ₪</td></tr>)}</tbody></table>
      </div>
      <div className="card">
        <h2>לפי דירה</h2>
        <table><thead><tr><th>דירה</th><th>בעלים</th><th>לילות</th><th>תפוסה</th><th>הכנסה</th></tr></thead>
          <tbody>{s.rows.map((r) => <tr key={r.id}><td>{r.name}</td><td>{r.owner}</td><td>{r.nights}</td><td>{r.occupancy}%</td><td>{r.revenue.toLocaleString()} ₪</td></tr>)}</tbody></table>
      </div>
    </Shell>
  );
}
