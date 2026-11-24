import Link from "next/link";
import { getSession } from "@/lib/auth";
import { loadAlerts } from "@/lib/alerts-data";
import Shell from "@/components/Shell";

export default async function Alerts() {
  const { supabase, role, name } = await getSession(["admin", "agent"]);
  const alerts = await loadAlerts(supabase);
  return (
    <Shell role={role} name={name}>
      <h1>התראות</h1>
      <div className="card">
        <p className="muted">דברים שדורשים טיפול עכשיו: תפיסות שעומדות לפוג, כניסות קרובות, מקדמות חסרות והגדרות חסרות בדירות.</p>
        {alerts.length === 0 && <p>אין התראות. הכול מסודר.</p>}
        {alerts.map((a, i) => (
          <div key={i} className="row" style={{ borderTop: "1px solid var(--line)", padding: "8px 0" }}>
            <span><strong className={a.sev === "bad" ? "err" : "ok"}>{a.sev === "bad" ? "דחוף" : "לתשומת לב"}</strong> · {a.text}</span>
            {a.href && <Link className="btn" href={a.href}>פתח</Link>}
          </div>
        ))}
      </div>
    </Shell>
  );
}
