import { revalidatePath } from "next/cache";
import Link from "next/link";
import { getSession } from "@/lib/auth";
import Collapsible from "@/components/Collapsible";
import Shell from "@/components/Shell";
import { invoiceLines } from "@/lib/finance";
import { loadFinSettings, loadPBookings, monthParam } from "@/lib/fin-data";

const ST: Record<string, string> = { draft: "טיוטה", sent: "נשלחה", paid: "שולמה" };

async function generate(fd: FormData) {
  "use server";
  const { supabase } = await getSession(["admin"]);
  const ownerId = String(fd.get("owner_id")), month = monthParam(String(fd.get("month")), false);
  const fin = await loadFinSettings(supabase);
  const inv = invoiceLines(await loadPBookings(supabase), ownerId, month, fin.vatPct);
  if (!inv.lines.length) return;
  await supabase.from("commission_invoices").insert({ owner_id: ownerId, month, net: inv.net, vat: inv.vat, total: inv.total, lines: inv.lines });
  revalidatePath("/invoices");
}
async function advance(fd: FormData) {
  "use server";
  const { supabase } = await getSession(["admin"]);
  const next = String(fd.get("status")) === "sent" ? "sent" : "paid";
  await supabase.from("commission_invoices").update({ status: next }).eq("id", String(fd.get("id")));
  revalidatePath("/invoices");
}
async function removeDraft(fd: FormData) {
  "use server";
  const { supabase } = await getSession(["admin"]);
  await supabase.from("commission_invoices").delete().eq("id", String(fd.get("id"))).eq("status", "draft");
  revalidatePath("/invoices");
}

export default async function Invoices() {
  const { supabase, role, name } = await getSession(["admin"]);
  const [{ data: owners }, { data: invs }] = await Promise.all([
    supabase.from("owners").select("id, name").order("name"),
    supabase.from("commission_invoices").select("*, owners(name)").order("number", { ascending: false }),
  ]);
  return (
    <Shell role={role} name={name}>
      <h1>חשבוניות עמלה לבעלי דירות</h1>
      <Collapsible title="הפקת טיוטה" summary="בעל דירה וחודש">
        <p className="muted">מפיקים טיוטה מההזמנות הסגורות של בעל הדירה בחודש (לפי תאריך כניסה). המסמך הוא טיוטה לעיון ולא חשבונית מס רשמית.</p>
        <form action={generate}>
          <div className="grid2">
            <div><label>בעל דירה</label><select name="owner_id" required>{(owners ?? []).map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</select></div>
            <div><label>חודש</label><input type="month" name="month" defaultValue={monthParam(undefined)} required /></div>
          </div>
          <button className="primary">הפקת טיוטה</button>
        </form>
      </Collapsible>
      {(invs ?? []).map((i: any) => (
        <div key={i.id} className="card">
          <div className="row"><h2 style={{ margin: 0 }}>חשבונית {i.number} · {i.owners?.name}</h2><span>{ST[i.status]}</span></div>
          <p className="muted">{i.month} · {(i.lines as any[]).length} הזמנות</p>
          <p>לפני מע״מ <strong>{i.net.toLocaleString()} ₪</strong> · מע״מ <strong>{i.vat.toLocaleString()} ₪</strong> · סך הכל <strong>{i.total.toLocaleString()} ₪</strong></p>
          <div className="row">
            <Link className="btn" href={`/invoices/${i.id}`}>תצוגה להדפסה</Link>
            {i.status === "draft" && <form action={advance}><input type="hidden" name="id" value={i.id} /><button className="btn" name="status" value="sent">סמן כנשלחה</button></form>}
            {i.status === "sent" && <form action={advance}><input type="hidden" name="id" value={i.id} /><button className="btn" name="status" value="paid">סמן כשולמה</button></form>}
            {i.status === "draft" && <form action={removeDraft}><input type="hidden" name="id" value={i.id} /><button className="danger">מחיקת טיוטה</button></form>}
          </div>
        </div>
      ))}
      {!invs?.length && <div className="card muted">עדיין לא הופקו חשבוניות.</div>}
    </Shell>
  );
}
