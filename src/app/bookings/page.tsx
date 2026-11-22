import Link from "next/link";
import { getSession } from "@/lib/auth";
import Shell from "@/components/Shell";
import { fmtDate } from "@/lib/weekends";

const STATUS_HE: Record<string, string> = { hold: "ממתינה למקדמה", confirmed: "סגורה", cancelled: "בוטלה", expired: "פגה" };

export default async function Bookings() {
  const { supabase, role, name } = await getSession(["admin", "agent", "owner"]);
  const { data } = await supabase.from("bookings")
    .select("id, check_in, check_out, status, total_price, apartments(name), customers(full_name)")
    .order("created_at", { ascending: false }).limit(100);
  return (
    <Shell role={role} name={name}>
      <h1>הזמנות</h1>
      <div className="card">
        <table>
          <thead><tr><th>דירה</th><th>תאריכים</th><th>לקוח</th><th>סכום</th><th>סטטוס</th><th></th></tr></thead>
          <tbody>
            {data?.map((b: any) => (
              <tr key={b.id}>
                <td>{b.apartments?.name}</td><td>{fmtDate(b.check_in)} – {fmtDate(b.check_out)}</td>
                <td>{b.customers?.full_name}</td><td>{b.total_price} ₪</td><td>{STATUS_HE[b.status]}</td>
                <td>{role !== "owner" && <Link href={`/bookings/${b.id}`}>פתח</Link>}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!data?.length && <p className="muted">אין הזמנות.</p>}
      </div>
    </Shell>
  );
}
