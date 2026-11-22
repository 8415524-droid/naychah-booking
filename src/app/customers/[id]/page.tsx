import Link from "next/link";
import { notFound } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth";
import Shell from "@/components/Shell";
import { fmtDate } from "@/lib/weekends";

const STATUS_HE: Record<string, string> = { hold: "ממתינה למקדמה", confirmed: "סגורה", cancelled: "בוטלה", expired: "פגה" };

async function saveCustomer(fd: FormData) {
  "use server";
  const { supabase } = await getSession(["admin", "agent"]);
  const id = String(fd.get("id"));
  await supabase.from("customers").update({
    full_name: String(fd.get("full_name") || "").trim(),
    notes: String(fd.get("notes") || "") || null,
  }).eq("id", id);
  revalidatePath(`/customers/${id}`);
}

export default async function Customer({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, role, name } = await getSession(["admin", "agent"]);
  const { data: c } = await supabase.from("customers").select("*").eq("id", id).single();
  if (!c) notFound();
  const { data: bookings } = await supabase.from("bookings")
    .select("id, check_in, check_out, status, total_price, deposit_required, apartments(name)")
    .eq("customer_id", id).order("check_in", { ascending: false });
  const ids = (bookings ?? []).map((b) => b.id);
  const { data: payments } = ids.length
    ? await supabase.from("payments").select("receipt_no, amount, method, created_at, booking_id").in("booking_id", ids).order("created_at", { ascending: false })
    : { data: [] as any[] };
  const { data: calls } = await supabase.from("call_log").select("id, direction, kind, created_at, recording_url, note")
    .or(`customer_id.eq.${id},phone.eq.${c.phone}`).order("created_at", { ascending: false }).limit(50);
  const paid = (payments ?? []).reduce((s, p) => s + p.amount, 0);

  return (
    <Shell role={role} name={name}>
      <h1>{c.full_name}</h1>
      <form className="card" action={saveCustomer}>
        <input type="hidden" name="id" value={id} />
        <p>טלפון: <strong>{c.phone}</strong> · לקוח מאז {fmtDate(c.created_at.slice(0, 10))} · שולם סך הכול: {paid.toLocaleString()} ₪</p>
        <label>שם</label><input name="full_name" defaultValue={c.full_name} required />
        <label>הערות</label><textarea name="notes" rows={3} defaultValue={c.notes ?? ""} />
        <button className="primary">שמירה</button>
      </form>

      <div className="card">
        <h2>הזמנות</h2>
        <table>
          <thead><tr><th>דירה</th><th>תאריכים</th><th>סכום</th><th>סטטוס</th><th></th></tr></thead>
          <tbody>{bookings?.map((b: any) => (
            <tr key={b.id}><td>{b.apartments?.name}</td><td>{fmtDate(b.check_in)} – {fmtDate(b.check_out)}</td>
              <td>{b.total_price} ₪</td><td>{STATUS_HE[b.status]}</td><td><Link href={`/bookings/${b.id}`}>פתח</Link></td></tr>
          ))}</tbody>
        </table>
        {!bookings?.length && <p className="muted">אין הזמנות.</p>}
      </div>

      <div className="card">
        <h2>תשלומים וקבלות</h2>
        <table>
          <thead><tr><th>מס' קבלה</th><th>סכום</th><th>אמצעי</th><th>תאריך</th></tr></thead>
          <tbody>{payments?.map((p: any) => <tr key={p.receipt_no}><td>{p.receipt_no}</td><td>{p.amount} ₪</td><td>{p.method}</td><td>{fmtDate(p.created_at.slice(0, 10))}</td></tr>)}</tbody>
        </table>
        {!payments?.length && <p className="muted">אין תשלומים.</p>}
      </div>

      <div className="card">
        <h2>שיחות והקלטות</h2>
        <table>
          <thead><tr><th>תאריך</th><th>סוג</th><th>הקלטה</th></tr></thead>
          <tbody>{calls?.map((k) => (
            <tr key={k.id}><td>{fmtDate(k.created_at.slice(0, 10))}</td><td>{k.direction === "in" ? "נכנסת" : "יוצאת"} {k.kind ?? ""}</td>
              <td>{k.recording_url ? <a href={k.recording_url}>האזנה</a> : "—"}</td></tr>
          ))}</tbody>
        </table>
        {!calls?.length && <p className="muted">אין שיחות רשומות.</p>}
      </div>
    </Shell>
  );
}
