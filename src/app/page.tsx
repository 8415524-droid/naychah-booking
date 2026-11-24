import Link from "next/link";
import { getSession } from "@/lib/auth";
import Shell from "@/components/Shell";
import { fmtDate } from "@/lib/weekends";
import { loadAlerts } from "@/lib/alerts-data";

const STATUS_HE: Record<string, string> = { hold: "ממתינה למקדמה", confirmed: "סגורה" };

export default async function Home() {
  const { supabase, role, name } = await getSession();
  if (role === "none") {
    return <Shell role={role} name={name}><div className="card">החשבון שלך עדיין לא קיבל הרשאה. פנה למנהל.</div></Shell>;
  }
  const staff = role === "admin" || role === "agent";
  const today = new Date().toISOString().slice(0, 10);
  const [apts, confirmed, holds, customers, upcoming] = await Promise.all([
    supabase.from("apartments").select("id", { count: "exact", head: true }).eq("active", true),
    supabase.from("bookings").select("id", { count: "exact", head: true }).eq("status", "confirmed").gte("check_out", today),
    supabase.from("bookings").select("id", { count: "exact", head: true }).eq("status", "hold"),
    staff ? supabase.from("customers").select("id", { count: "exact", head: true }) : Promise.resolve({ count: null }),
    supabase.from("bookings")
      .select("id, check_in, check_out, status, apartments(name), customers(full_name)")
      .in("status", ["hold", "confirmed"]).gte("check_out", today).order("check_in").limit(8),
  ]);

  const alerts = staff ? await loadAlerts(supabase) : [];
  return (
    <Shell role={role} name={name}>
      <h1>שלום {name}</h1>
      <div className="stats">
        <Link className="stat" href="/apartments"><div className="stat-n">{apts.count ?? 0}</div><div className="stat-l">דירות פעילות</div></Link>
        <Link className="stat" href="/bookings"><div className="stat-n">{confirmed.count ?? 0}</div><div className="stat-l">הזמנות סגורות קרובות</div></Link>
        <Link className="stat" href="/bookings"><div className="stat-n">{holds.count ?? 0}</div><div className="stat-l">ממתינות למקדמה</div></Link>
        {staff && <Link className="stat" href="/customers"><div className="stat-n">{customers.count ?? 0}</div><div className="stat-l">לקוחות</div></Link>}
      </div>
      {alerts.length > 0 && (
        <div className="card">
          <div className="row"><h2 style={{ margin: 0 }}>דורש טיפול ({alerts.length})</h2><Link className="btn" href="/alerts">כל ההתראות</Link></div>
          {alerts.slice(0, 5).map((a, i) => <p key={i}><strong className={a.sev === "bad" ? "err" : "ok"}>{a.sev === "bad" ? "דחוף" : "לתשומת לב"}</strong> · {a.href ? <Link href={a.href}>{a.text}</Link> : a.text}</p>)}
        </div>
      )}
      <div className="card">
        <div className="row"><h2 style={{ margin: 0 }}>הזמנות קרובות</h2>{staff && <Link className="btn" href="/search">חיפוש דירה ללקוח</Link>}</div>
        <table>
          <thead><tr><th>דירה</th><th>תאריכים</th><th>לקוח</th><th>סטטוס</th></tr></thead>
          <tbody>
            {(upcoming.data as any[] | null)?.map((b) => (
              <tr key={b.id}>
                <td>{b.apartments?.name}</td><td>{fmtDate(b.check_in)} – {fmtDate(b.check_out)}</td>
                <td>{b.customers?.full_name}</td>
                <td>{staff ? <Link href={`/bookings/${b.id}`}>{STATUS_HE[b.status]}</Link> : STATUS_HE[b.status]}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!upcoming.data?.length && <p className="muted">אין הזמנות קרובות.</p>}
      </div>
    </Shell>
  );
}
