import { getSession } from "@/lib/auth";
import MonthForm from "@/components/MonthForm";
import Shell from "@/components/Shell";
import { settlement } from "@/lib/finance";
import { loadCosts, loadPBookings, monthParam } from "@/lib/fin-data";

const money = (n: number) => `${Math.round(n).toLocaleString()} ₪`;

export default async function Settlement({ searchParams }: { searchParams: Promise<{ m?: string }> }) {
  const sp = await searchParams;
  const { supabase, role, name } = await getSession(["admin", "partner"]);
  const month = monthParam(sp.m);
  const [bookings, costs] = await Promise.all([loadPBookings(supabase), loadCosts(supabase)]);
  const ded = costs.filter((c) => c.charge_owner && c.owner_id && (month === "all" || c.month === month)).map((c) => ({ owner_id: c.owner_id!, amount: c.amount }));
  const rows = settlement(bookings, ded, month);
  const t = rows.reduce((a, r) => ({ gross: a.gross + r.gross, company: a.company + r.company, due: a.due + r.due, ded: a.ded + r.ded, net: a.net + r.net }), { gross: 0, company: 0, due: 0, ded: 0, net: 0 });
  return (
    <Shell role={role} name={name}>
      <h1>התחשבנות עם בעלי דירות</h1>
      <MonthForm month={month} allowAll />
      <div className="stats">
        {([["מחזור הזמנות", t.gross], ["חלק החברה (מקדמות)", t.company], ["מגיע לבעלי דירות", t.due], ["ניכויים (חשבונות ותחזוקה)", t.ded], ["נטו לבעלי דירות", t.net]] as [string, number][]).map(([l, v]) =>
          <div className="stat" key={l}><div className="stat-n">{money(v)}</div><div className="stat-l">{l}</div></div>)}
      </div>
      <div className="card">
        <p className="muted">הלקוח משלם לבעל הדירה את היתרה (סכום ההזמנה פחות המקדמה). הטבלה מראה כמה מגיע לכל בעל דירה, אחרי ניכוי חשבונות ותחזוקה שהחברה שילמה בשמו.</p>
        <table>
          <thead><tr><th>בעל דירה</th><th>הזמנות</th><th>מחזור</th><th>חלק החברה</th><th>מגיע לו</th><th>ניכויים</th><th>נטו</th></tr></thead>
          <tbody>{rows.map((r) => <tr key={r.owner}><td>{r.owner}</td><td>{r.n}</td><td>{money(r.gross)}</td><td>{money(r.company)}</td><td>{money(r.due)}</td><td>{money(r.ded)}</td><td><strong>{money(r.net)}</strong></td></tr>)}</tbody>
        </table>
        {rows.length === 0 && <p className="muted">אין הזמנות סגורות בתקופה.</p>}
      </div>
    </Shell>
  );
}
