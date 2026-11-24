import { revalidatePath } from "next/cache";
import Link from "next/link";
import { getSession } from "@/lib/auth";
import Collapsible from "@/components/Collapsible";
import Shell from "@/components/Shell";
import { addDays, nowInJerusalem } from "@/lib/pricing";
import { fmtDate } from "@/lib/weekends";

const PRI = { high: "דחופה", normal: "רגילה", low: "נמוכה" } as Record<string, string>;
const ST = { open: "פתוחה", doing: "בטיפול", done: "בוצעה" } as Record<string, string>;
const ROLES = ["admin", "agent", "vendor"] as const;

async function add(fd: FormData) {
  "use server";
  const { supabase } = await getSession([...ROLES]);
  const title = String(fd.get("title") || "").trim();
  if (!title || !fd.get("apartment_id")) return;
  await supabase.from("maintenance_tasks").insert({
    apartment_id: String(fd.get("apartment_id")), title, priority: String(fd.get("priority")), due_on: String(fd.get("due_on") || "") || null,
    est_cost: Math.max(0, Math.round(Number(fd.get("est_cost")) || 0)), vendor: String(fd.get("vendor") || "") || null, charge_owner: fd.get("charge_owner") === "on",
  });
  revalidatePath("/maintenance");
}
async function setStatus(fd: FormData) {
  "use server";
  const { supabase } = await getSession([...ROLES]);
  const status = String(fd.get("status"));
  if (!["doing", "done"].includes(status)) return;
  await supabase.from("maintenance_tasks").update({ status }).eq("id", String(fd.get("id")));
  revalidatePath("/maintenance");
}
async function removeTask(fd: FormData) {
  "use server";
  const { supabase } = await getSession(["admin"]);
  await supabase.from("maintenance_tasks").delete().eq("id", String(fd.get("id")));
  revalidatePath("/maintenance");
}
async function cleanDone(fd: FormData) {
  "use server";
  const { supabase } = await getSession([...ROLES]);
  await supabase.from("cleanings").upsert({ booking_id: String(fd.get("booking_id")), cost: Math.max(0, Math.round(Number(fd.get("cost")) || 0)) });
  revalidatePath("/maintenance");
}
async function cleanUndo(fd: FormData) {
  "use server";
  const { supabase } = await getSession([...ROLES]);
  await supabase.from("cleanings").delete().eq("booking_id", String(fd.get("booking_id")));
  revalidatePath("/maintenance");
}

export default async function Maintenance({ searchParams }: { searchParams: Promise<{ all?: string }> }) {
  const sp = await searchParams;
  const { supabase, role, name } = await getSession([...ROLES]);
  const today = nowInJerusalem().slice(0, 10);
  const [{ data: apts }, { data: tasks }, { data: outs }, { data: cleans }, { data: nextIns }] = await Promise.all([
    supabase.from("apartments").select("id, name").eq("active", true).order("name"),
    supabase.from("maintenance_tasks").select("*, apartments(name)").order("created_at", { ascending: false }),
    supabase.from("bookings").select("id, apartment_id, check_out, apartments(name)").eq("status", "confirmed").gte("check_out", addDays(today, -7)).lte("check_out", addDays(today, 14)).order("check_out"),
    supabase.from("cleanings").select("booking_id, cost"),
    supabase.from("bookings").select("apartment_id, check_in").in("status", ["confirmed", "hold"]).gte("check_in", addDays(today, -7)),
  ]);
  const list = (tasks ?? []).filter((t) => sp.all === "1" || t.status !== "done")
    .sort((a, b) => (a.priority === "high" ? 0 : 1) - (b.priority === "high" ? 0 : 1));
  return (
    <Shell role={role} name={name}>
      <h1>תחזוקה וניקיון</h1>
      <Collapsible title="פתיחת קריאה" summary="בית, תקלה, דחיפות">
        <form action={add}>
          <div className="grid2">
            <div><label>דירה</label><select name="apartment_id" required>{(apts ?? []).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></div>
            <div><label>מה הבעיה</label><input name="title" required /></div>
            <div><label>דחיפות</label><select name="priority" defaultValue="normal"><option value="normal">רגילה</option><option value="high">דחופה</option><option value="low">נמוכה</option></select></div>
            <div><label>לביצוע עד</label><input type="date" name="due_on" /></div>
            <div><label>עלות משוערת (₪)</label><input type="number" name="est_cost" min={0} defaultValue={0} /></div>
            <div><label>בעל מקצוע</label><input name="vendor" /></div>
          </div>
          <label className="checks"><input type="checkbox" name="charge_owner" /> לחייב את בעל הדירה בעלות</label>
          <button className="primary">פתיחת קריאה</button>
        </form>
      </Collapsible>
      <div className="card">
        <div className="row"><h2 style={{ margin: 0 }}>קריאות</h2><Link className="btn" href={sp.all === "1" ? "/maintenance" : "/maintenance?all=1"}>{sp.all === "1" ? "רק פתוחות" : "הצג הכול"}</Link></div>
        {list.length === 0 && <p className="muted">אין קריאות פתוחות.</p>}
        {list.map((t: any) => (
          <div key={t.id} className="row" style={{ borderTop: "1px solid var(--line)", padding: "8px 0" }}>
            <span><strong>{t.title}</strong> · {t.apartments?.name}<br /><span className="muted">{ST[t.status]} · {PRI[t.priority]}{t.due_on ? ` · עד ${fmtDate(t.due_on)}` : ""} · {t.vendor ?? "בלי בעל מקצוע"} · {t.est_cost} ₪{t.charge_owner ? " · מחויב לבעל הדירה" : ""}</span></span>
            <span>
              {t.status === "open" && <form action={setStatus} style={{ display: "inline" }}><input type="hidden" name="id" value={t.id} /><button className="btn" name="status" value="doing">התחל טיפול</button></form>}{" "}
              {t.status !== "done" && <form action={setStatus} style={{ display: "inline" }}><input type="hidden" name="id" value={t.id} /><button className="btn" name="status" value="done">סמן בוצע</button></form>}{" "}
              {role === "admin" && <form action={removeTask} style={{ display: "inline" }}><input type="hidden" name="id" value={t.id} /><button className="danger">מחיקה</button></form>}
            </span>
          </div>
        ))}
      </div>
      <div className="card">
        <h2>ניקיון אחרי יציאה</h2>
        <p className="muted">כל יציאה מ-7 הימים האחרונים ועד שבועיים קדימה. אם יש כניסה באותה דירה ביום היציאה או למחרת, מסומן דחוף.</p>
        <table>
          <thead><tr><th>דירה</th><th>יציאה</th><th>כניסה הבאה</th><th>סטטוס</th></tr></thead>
          <tbody>{(outs ?? []).map((b: any) => {
            const c = cleans?.find((x) => x.booking_id === b.id);
            const next = (nextIns ?? []).filter((n) => n.apartment_id === b.apartment_id && n.check_in >= b.check_out).sort((x, y) => x.check_in.localeCompare(y.check_in))[0];
            const tight = next && next.check_in <= addDays(b.check_out, 1);
            return (
              <tr key={b.id}>
                <td>{b.apartments?.name}</td><td>{fmtDate(b.check_out)}</td>
                <td>{next ? fmtDate(next.check_in) : "—"}{tight && <strong className="err"> דחוף</strong>}</td>
                <td>{c ? <form action={cleanUndo}><input type="hidden" name="booking_id" value={b.id} /><span className="ok">נוקה · {c.cost} ₪</span> <button className="danger">בטל</button></form>
                  : <form action={cleanDone} className="row"><input type="hidden" name="booking_id" value={b.id} /><input type="number" name="cost" min={0} defaultValue={0} style={{ width: 90 }} title="עלות ניקיון" /><button className="btn">סמן נוקה</button></form>}</td>
              </tr>
            );
          })}</tbody>
        </table>
      </div>
    </Shell>
  );
}
