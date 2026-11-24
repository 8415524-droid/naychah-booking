import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth";
import Collapsible from "@/components/Collapsible";
import DataTable from "@/components/DataTable";
import MonthForm from "@/components/MonthForm";
import Shell from "@/components/Shell";
import { BILL_TYPES } from "@/lib/finance";
import { monthParam } from "@/lib/fin-data";
import { nowInJerusalem } from "@/lib/pricing";
import { fmtDate } from "@/lib/weekends";

async function add(fd: FormData) {
  "use server";
  const { supabase } = await getSession(["admin"]);
  const amount = Math.round(Number(fd.get("amount")));
  if (!(amount >= 0) || !fd.get("apartment_id")) return;
  await supabase.from("apartment_bills").insert({
    apartment_id: String(fd.get("apartment_id")), bill_type: String(fd.get("bill_type")), period: String(fd.get("period")), amount,
    due_on: String(fd.get("due_on") || "") || null, paid_by: fd.get("paid_by") === "owner" ? "owner" : "company",
    charge_owner: fd.get("charge_owner") === "on", paid: fd.get("paid") === "on",
  });
  revalidatePath("/bills");
}
async function markPaid(fd: FormData) {
  "use server";
  const { supabase } = await getSession(["admin"]);
  await supabase.from("apartment_bills").update({ paid: true }).eq("id", String(fd.get("id")));
  revalidatePath("/bills");
}
async function removeMany(ids: string[]) {
  "use server";
  const { supabase } = await getSession(["admin"]);
  if (ids.length) await supabase.from("apartment_bills").delete().in("id", ids);
  revalidatePath("/bills");
}

export default async function Bills({ searchParams }: { searchParams: Promise<{ m?: string }> }) {
  const sp = await searchParams;
  const { supabase, role, name } = await getSession(["admin"]);
  const month = monthParam(sp.m);
  const [{ data: apts }, { data: bills }] = await Promise.all([
    supabase.from("apartments").select("id, name").eq("active", true).order("name"),
    supabase.from("apartment_bills").select("*, apartments(name)").order("period", { ascending: false }),
  ]);
  const list = (bills ?? []).filter((b) => month === "all" || b.period === month);
  const unpaid = (bills ?? []).filter((b) => !b.paid).reduce((s, b) => s + b.amount, 0);
  const charged = (bills ?? []).filter((b) => b.paid && b.paid_by === "company" && b.charge_owner).reduce((s, b) => s + b.amount, 0);
  return (
    <Shell role={role} name={name}>
      <h1>חשבונות נכס</h1>
      <Collapsible title="הוספת חשבון" summary="חשמל, מים, ארנונה ועוד">
        <p className="muted">חשבון שהחברה שילמה ומסומן לחיוב בעל הדירה יורד מהתשלום אליו בהתחשבנות. חשבון שהחברה שילמה בלי חיוב נכנס להוצאות.</p>
        <form action={add}>
          <div className="grid2">
            <div><label>דירה</label><select name="apartment_id" required>{(apts ?? []).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></div>
            <div><label>סוג</label><select name="bill_type">{BILL_TYPES.map((t) => <option key={t}>{t}</option>)}</select></div>
            <div><label>לתקופה</label><input type="month" name="period" defaultValue={nowInJerusalem().slice(0, 7)} required /></div>
            <div><label>סכום (₪)</label><input type="number" name="amount" min={0} required /></div>
            <div><label>לתשלום עד</label><input type="date" name="due_on" /></div>
            <div><label>מי משלם</label><select name="paid_by"><option value="company">החברה</option><option value="owner">בעל הדירה ישירות</option></select></div>
          </div>
          <label className="checks"><input type="checkbox" name="charge_owner" /> לחייב את בעל הדירה</label>
          <label className="checks"><input type="checkbox" name="paid" /> כבר שולם</label>
          <button className="primary">הוספה</button>
        </form>
      </Collapsible>
      <MonthForm month={month} allowAll />
      <div className="card">
        <p>לא שולמו: <strong>{unpaid.toLocaleString()} ₪</strong> · שולם ומחויב לבעלי דירות: <strong>{charged.toLocaleString()} ₪</strong></p>
        <DataTable filename="bills"
          columns={[{ key: "a", label: "דירה", filter: true }, { key: "t", label: "סוג", filter: true }, { key: "p", label: "תקופה" }, { key: "s", label: "סכום" }, { key: "w", label: "שילם" }, { key: "st", label: "סטטוס", filter: true }, { key: "x", label: "" }]}
          rows={list.map((b: any) => ({ id: b.id, cells: {
            a: { text: b.apartments?.name ?? "" }, t: { text: b.bill_type }, p: { text: b.period }, s: { text: `${b.amount.toLocaleString()} ₪` },
            w: { text: b.paid_by === "company" ? `החברה${b.charge_owner ? " (מחויב)" : ""}` : "בעל הדירה" },
            st: { text: b.paid ? "שולם" : b.due_on ? `עד ${fmtDate(b.due_on)}` : "פתוח" },
            x: { text: "", node: b.paid ? null : <form action={markPaid}><input type="hidden" name="id" value={b.id} /><button className="btn">סמן שולם</button></form> },
          } }))}
          bulkAction={{ label: "מחיקת הנבחרים", confirm: "למחוק את החשבונות שנבחרו?", run: removeMany }} empty="אין חשבונות בתקופה." />
      </div>
    </Shell>
  );
}
