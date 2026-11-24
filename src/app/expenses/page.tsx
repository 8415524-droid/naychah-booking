import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth";
import Collapsible from "@/components/Collapsible";
import DataTable from "@/components/DataTable";
import MonthForm from "@/components/MonthForm";
import Shell from "@/components/Shell";
import { EXPENSE_CATEGORIES, vatSplit } from "@/lib/finance";
import { loadFinSettings, monthParam } from "@/lib/fin-data";
import { fmtDate } from "@/lib/weekends";

async function add(fd: FormData) {
  "use server";
  const { supabase } = await getSession(["admin"]);
  const amount = Math.round(Number(fd.get("amount")));
  if (!(amount >= 0)) return;
  await supabase.from("expenses").insert({
    spent_on: String(fd.get("spent_on")), category: String(fd.get("category")),
    description: String(fd.get("description") || "") || null, amount, includes_vat: fd.get("includes_vat") === "on",
  });
  revalidatePath("/expenses");
}
async function removeMany(ids: string[]) {
  "use server";
  const { supabase } = await getSession(["admin"]);
  if (ids.length) await supabase.from("expenses").delete().in("id", ids);
  revalidatePath("/expenses");
}

export default async function Expenses({ searchParams }: { searchParams: Promise<{ m?: string }> }) {
  const sp = await searchParams;
  const { supabase, role, name } = await getSession(["admin"]);
  const month = monthParam(sp.m);
  const fin = await loadFinSettings(supabase);
  const { data } = await supabase.from("expenses").select("*").order("spent_on", { ascending: false });
  const list = (data ?? []).filter((e) => month === "all" || e.spent_on.slice(0, 7) === month);
  const tot = list.reduce((s, e) => s + e.amount, 0);
  const vat = list.reduce((s, e) => s + vatSplit(e.amount, fin.vatPct, e.includes_vat).vat, 0);
  const today = new Date().toISOString().slice(0, 10);
  return (
    <Shell role={role} name={name}>
      <h1>הוצאות</h1>
      <Collapsible title="הוספת הוצאה" summary="תאריך, קטגוריה, סכום">
        <form action={add}>
          <div className="grid2">
            <div><label>תאריך</label><input type="date" name="spent_on" defaultValue={today} required /></div>
            <div><label>קטגוריה</label><select name="category">{EXPENSE_CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></div>
            <div><label>תיאור</label><input name="description" /></div>
            <div><label>סכום ששולם (₪)</label><input type="number" name="amount" min={0} required /></div>
          </div>
          <label className="checks"><input type="checkbox" name="includes_vat" defaultChecked /> הסכום כולל מע״מ שניתן לקיזוז (יש חשבונית מס)</label>
          <button className="primary">הוספה</button>
        </form>
      </Collapsible>
      <MonthForm month={month} allowAll />
      <div className="card">
        <p>סך ההוצאות: <strong>{tot.toLocaleString()} ₪</strong> · מע״מ לקיזוז: <strong>{Math.round(vat).toLocaleString()} ₪</strong></p>
        <DataTable filename="expenses"
          columns={[{ key: "d", label: "תאריך" }, { key: "c", label: "קטגוריה", filter: true }, { key: "t", label: "תיאור" }, { key: "a", label: "סכום" }]}
          rows={list.map((e) => ({ id: e.id, cells: { d: { text: fmtDate(e.spent_on) }, c: { text: e.category }, t: { text: (e.description ?? "") + (e.includes_vat ? "" : " (ללא מע״מ)") }, a: { text: `${e.amount.toLocaleString()} ₪` } } }))}
          bulkAction={{ label: "מחיקת הנבחרות", confirm: "למחוק את ההוצאות שנבחרו?", run: removeMany }} empty="אין הוצאות בתקופה." />
      </div>
    </Shell>
  );
}
