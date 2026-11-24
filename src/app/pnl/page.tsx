import { getSession } from "@/lib/auth";
import MonthForm from "@/components/MonthForm";
import Shell from "@/components/Shell";
import { plSummary } from "@/lib/finance";
import { loadCosts, loadFinSettings, loadPayrollCost, loadPBookings, monthParam } from "@/lib/fin-data";
import { monthsBack } from "@/lib/finance";

const money = (n: number) => `${Math.round(n).toLocaleString()} ₪`;

export default async function Pnl({ searchParams }: { searchParams: Promise<{ m?: string }> }) {
  const sp = await searchParams;
  const { supabase, role, name } = await getSession(["admin", "partner"]);
  const month = monthParam(sp.m);
  const fin = await loadFinSettings(supabase);
  const [bookings, costs, { data: exps }] = await Promise.all([loadPBookings(supabase), loadCosts(supabase), supabase.from("expenses").select("spent_on, category, amount, includes_vat")]);
  const payCost = await loadPayrollCost(supabase, month, fin.oncostPct);
  const r = plSummary(month, bookings, exps ?? [], costs, payCost, fin);
  const last6 = await Promise.all(monthsBack(month === "all" ? new Date().toISOString().slice(0, 7) : month, 6).reverse().map(async (m) =>
    ({ m, rev: plSummary(m, bookings, [], [], 0, fin).rev })));
  const max = Math.max(1, ...last6.map((x) => x.rev));
  return (
    <Shell role={role} name={name}>
      <h1>רווח והפסד</h1>
      <MonthForm month={month} allowAll />
      <div className="stats">
        {([["מחזור הזמנות", r.gross], ["הכנסות החברה (מקדמות)", r.rev], ["הוצאות (כולל פרסום, ניקיון, תחזוקה)", r.expNet], ["שכר (עלות מעביד)", r.payrollCost], ["רווח", r.profit]] as [string, number][]).map(([l, v]) =>
          <div className="stat" key={l}><div className="stat-n">{money(v)}</div><div className="stat-l">{l}</div></div>)}
        <div className="stat"><div className="stat-n">{r.margin == null ? "—" : `${r.margin}%`}</div><div className="stat-l">שולי רווח</div></div>
      </div>
      <div className="card">
        <h2>מע״מ</h2>
        <p>עסקאות: <strong>{money(r.vatOut)}</strong> · תשומות: <strong>{money(r.vatIn)}</strong> · {r.vatOut >= r.vatIn ? "לתשלום" : "להחזר"}: <strong>{money(Math.abs(r.vatOut - r.vatIn))}</strong></p>
        <p className="muted">הכנסת החברה היא המקדמה (חלקנו), בתוספת מע״מ בשיעור {fin.vatPct}%. יש לאמת מול רואה החשבון.</p>
      </div>
      <div className="card">
        <h2>הכנסות 6 חודשים</h2>
        {last6.map((x) => <div key={x.m} className="row"><span>{x.m}</span><div style={{ flex: 1, background: "var(--panel-2)", borderRadius: 6 }}><div style={{ width: `${Math.round((x.rev / max) * 100)}%`, background: "var(--amber)", height: 12, borderRadius: 6 }} /></div><span>{money(x.rev)}</span></div>)}
      </div>
      <div className="card">
        <h2>לפי דירה</h2>
        <table><thead><tr><th>דירה</th><th>הזמנות</th><th>מחזור</th><th>הכנסה</th><th>עלויות ישירות</th><th>תרומה</th></tr></thead>
          <tbody>{r.perHouse.sort((a, b) => (b.rev - b.cost) - (a.rev - a.cost)).map((h) => <tr key={h.name}><td>{h.name}</td><td>{h.n}</td><td>{money(h.gross)}</td><td>{money(h.rev)}</td><td>{money(h.cost)}</td><td><strong>{money(h.rev - h.cost)}</strong></td></tr>)}</tbody></table>
      </div>
      <div className="card">
        <h2>הוצאות לפי קטגוריה</h2>
        <table><tbody>{Object.entries(r.byCat).map(([k, v]) => <tr key={k}><td>{k}</td><td>{money(v)}</td></tr>)}</tbody></table>
        {Object.keys(r.byCat).length === 0 && <p className="muted">אין הוצאות בתקופה.</p>}
      </div>
      <div className="card"><a className="btn" href={`/api/ledger?m=${month}`}>הנהלת חשבונות: ייצוא CSV לרואה החשבון</a></div>
    </Shell>
  );
}
