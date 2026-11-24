import Link from "next/link";
import { getSession } from "@/lib/auth";
import DataTable from "@/components/DataTable";
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
        <DataTable
          filename="bookings"
          columns={[
            { key: "apt", label: "דירה", filter: true }, { key: "dates", label: "תאריכים" }, { key: "cust", label: "לקוח" },
            { key: "price", label: "סכום" }, { key: "status", label: "סטטוס", filter: true }, { key: "open", label: "" },
          ]}
          rows={(data ?? []).map((b: any) => ({
            id: b.id,
            cells: {
              apt: { text: b.apartments?.name ?? "" },
              dates: { text: `${fmtDate(b.check_in)} – ${fmtDate(b.check_out)}` },
              cust: { text: b.customers?.full_name ?? "" },
              price: { text: `${b.total_price} ₪` },
              status: { text: STATUS_HE[b.status] ?? b.status },
              open: { text: "", node: role !== "owner" ? <Link href={`/bookings/${b.id}`}>פתח</Link> : null },
            },
          }))}
          empty="אין הזמנות."
        />
      </div>
    </Shell>
  );
}
