import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth";
import Shell from "@/components/Shell";
import { fmtDate } from "@/lib/weekends";

const STATUS_HE: Record<string, string> = { hold: "תפוסה זמנית, ממתינה למקדמה", confirmed: "סגורה", cancelled: "בוטלה", expired: "פגה" };

async function pay(fd: FormData) {
  "use server";
  const { supabase } = await getSession(["admin", "agent"]);
  const id = String(fd.get("booking_id"));
  const { error } = await supabase.rpc("record_payment", {
    p_booking: id, p_amount: Number(fd.get("amount")), p_method: String(fd.get("method")),
    p_reference: String(fd.get("reference") || "") || null,
  });
  if (error) redirect(`/bookings/${id}?err=${encodeURIComponent(error.message)}`);
  revalidatePath(`/bookings/${id}`);
}

async function cancel(fd: FormData) {
  "use server";
  const { supabase } = await getSession(["admin", "agent"]);
  const id = String(fd.get("booking_id"));
  await supabase.rpc("cancel_booking", { p_booking: id });
  revalidatePath(`/bookings/${id}`);
}

export default async function Booking({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ err?: string }> }) {
  const { id } = await params;
  const { err } = await searchParams;
  const { supabase, role, name } = await getSession(["admin", "agent"]);
  const { data: b } = await supabase.from("bookings")
    .select("*, apartments(name, owners(name, phone)), customers(full_name, phone)").eq("id", id).single();
  if (!b) notFound();
  const { data: payments } = await supabase.from("payments").select("*").eq("booking_id", id).order("created_at");
  const paid = (payments ?? []).reduce((s, p) => s + p.amount, 0);
  const remaining = Math.max(0, b.deposit_required - paid);
  const expired = b.status === "hold" && b.hold_expires_at && new Date(b.hold_expires_at) < new Date();
  const status = expired ? "expired" : b.status;

  return (
    <Shell role={role} name={name}>
      <h1>הזמנה · {b.apartments?.name}</h1>
      <div className="card">
        <p><strong>{STATUS_HE[status]}</strong></p>
        {status === "hold" && b.hold_expires_at && (
          <p>התפיסה משתחררת בשעה {new Date(b.hold_expires_at).toLocaleTimeString("he-IL", { timeZone: "Asia/Jerusalem", hour: "2-digit", minute: "2-digit" })} אם לא תשולם מקדמה.</p>
        )}
        <p>{fmtDate(b.check_in)} עד {fmtDate(b.check_out)} · {b.guests ?? "?"} אנשים</p>
        <p>לקוח: {b.customers?.full_name} · {b.customers?.phone}</p>
        <p>בעל הדירה: {b.apartments?.owners?.name} {b.apartments?.owners?.phone}</p>
        <p>סכום העסקה: <strong>{b.total_price.toLocaleString()} ₪</strong> · מקדמה נדרשת (12%): <strong>{b.deposit_required.toLocaleString()} ₪</strong> · שולם: {paid.toLocaleString()} ₪</p>
      </div>

      {payments && payments.length > 0 && (
        <div className="card">
          <h2>קבלות</h2>
          <table>
            <thead><tr><th>מס' קבלה</th><th>סכום</th><th>אמצעי</th><th>אסמכתא</th></tr></thead>
            <tbody>{payments.map((p) => <tr key={p.id}><td>{p.receipt_no}</td><td>{p.amount} ₪</td><td>{p.method}</td><td>{p.reference}</td></tr>)}</tbody>
          </table>
        </div>
      )}

      {status === "hold" && (
        <form className="card" action={pay}>
          <h2>רישום מקדמה</h2>
          <p className="muted">לא לרשום כאן מספר כרטיס אשראי. רק אסמכתא או 4 ספרות אחרונות.</p>
          <input type="hidden" name="booking_id" value={id} />
          <div className="grid2">
            <div><label>סכום (₪)</label><input type="number" name="amount" min={1} defaultValue={remaining} required /></div>
            <div><label>אמצעי תשלום</label>
              <select name="method" defaultValue="credit">
                <option value="credit">אשראי</option><option value="transfer">העברה</option>
                <option value="cash">מזומן</option><option value="other">אחר</option>
              </select></div>
            <div><label>אסמכתא</label><input name="reference" /></div>
          </div>
          {err && <p className="err">{err}</p>}
          <button className="primary">רשום תשלום</button>
        </form>
      )}

      {(status === "hold" || status === "confirmed") && (
        <form action={cancel}><input type="hidden" name="booking_id" value={id} /><button className="danger">ביטול הזמנה</button></form>
      )}
    </Shell>
  );
}
