import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth";
import Collapsible from "@/components/Collapsible";
import MonthForm from "@/components/MonthForm";
import Shell from "@/components/Shell";
import { employeeCost } from "@/lib/finance";
import { loadFinSettings, monthParam } from "@/lib/fin-data";

async function addEmployee(fd: FormData) {
  "use server";
  const { supabase } = await getSession(["admin"]);
  const name = String(fd.get("name") || "").trim();
  if (!name) return;
  await supabase.from("employees").insert({ name, role_title: String(fd.get("role_title") || "") || null, pay_kind: String(fd.get("pay_kind")) === "hourly" ? "hourly" : "monthly", rate: Math.max(0, Math.round(Number(fd.get("rate")) || 0)) });
  revalidatePath("/payroll");
}
async function removeEmployee(fd: FormData) {
  "use server";
  const { supabase } = await getSession(["admin"]);
  await supabase.from("employees").update({ active: false }).eq("id", String(fd.get("id")));
  revalidatePath("/payroll");
}
async function savePay(fd: FormData) {
  "use server";
  const { supabase } = await getSession(["admin"]);
  await supabase.from("payroll").upsert({
    employee_id: String(fd.get("employee_id")), month: String(fd.get("month")),
    hours: Math.max(0, Number(fd.get("hours")) || 0), bonus: Math.max(0, Math.round(Number(fd.get("bonus")) || 0)), paid: fd.get("paid") === "on",
  }, { onConflict: "employee_id,month" });
  revalidatePath("/payroll");
}

export default async function Payroll({ searchParams }: { searchParams: Promise<{ m?: string }> }) {
  const sp = await searchParams;
  const { supabase, role, name } = await getSession(["admin"]);
  const month = monthParam(sp.m, false);
  const fin = await loadFinSettings(supabase);
  const [{ data: emps }, { data: pay }] = await Promise.all([
    supabase.from("employees").select("*").eq("active", true).order("name"),
    supabase.from("payroll").select("*").eq("month", month),
  ]);
  let gross = 0, cost = 0;
  const rows = (emps ?? []).map((e) => {
    const p = pay?.find((x) => x.employee_id === e.id);
    const c = employeeCost(e, Number(p?.hours ?? 0), p?.bonus ?? 0, fin.oncostPct);
    gross += c.gross; cost += c.cost;
    return { e, p, c };
  });
  return (
    <Shell role={role} name={name}>
      <h1>משכורות</h1>
      <Collapsible title="הוספת עובד" summary="שם, תפקיד, שכר">
        <form action={addEmployee}>
          <div className="grid2">
            <div><label>שם</label><input name="name" required /></div>
            <div><label>תפקיד</label><input name="role_title" placeholder="טלפנית" /></div>
            <div><label>סוג שכר</label><select name="pay_kind"><option value="monthly">חודשי</option><option value="hourly">לשעה</option></select></div>
            <div><label>שכר חודשי או תעריף לשעה (₪)</label><input type="number" name="rate" min={0} required /></div>
          </div>
          <button className="primary">הוספה</button>
        </form>
      </Collapsible>
      <MonthForm month={month} />
      <div className="card">
        <p className="muted">הערכת עלות לחברה לפי {fin.oncostPct}% עלויות מעביד (ניתן לשינוי בהגדרות). זה אינו תלוש שכר, החישוב המלא אצל רואה החשבון.</p>
        {rows.length === 0 && <p>הוסיפו עובד כדי לחשב משכורת.</p>}
        {rows.map(({ e, p, c }) => (
          <form key={e.id} action={savePay} className="row" style={{ borderTop: "1px solid var(--line)", padding: "8px 0" }}>
            <input type="hidden" name="employee_id" value={e.id} /><input type="hidden" name="month" value={month} />
            <strong>{e.name}</strong><span className="muted">{e.role_title} · {e.pay_kind === "hourly" ? `${e.rate} ₪ לשעה` : `${e.rate.toLocaleString()} ₪ לחודש`}</span>
            {e.pay_kind === "hourly" && <input type="number" name="hours" step="0.5" min={0} defaultValue={Number(p?.hours ?? 0)} style={{ width: 90 }} title="שעות" />}
            <input type="number" name="bonus" min={0} defaultValue={p?.bonus ?? 0} style={{ width: 100 }} title="בונוס" />
            <span>ברוטו {Math.round(c.gross).toLocaleString()} · עלות {Math.round(c.cost).toLocaleString()} ₪</span>
            <label className="checks"><input type="checkbox" name="paid" defaultChecked={!!p?.paid} /> שולם</label>
            <button className="btn">שמירה</button>
            <button className="danger" formAction={removeEmployee} name="id" value={e.id}>הסרה</button>
          </form>
        ))}
        <p><strong>סה״כ ברוטו {Math.round(gross).toLocaleString()} ₪ · עלות לחברה {Math.round(cost).toLocaleString()} ₪</strong></p>
      </div>
    </Shell>
  );
}
