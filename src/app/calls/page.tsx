import Link from "next/link";
import { getSession } from "@/lib/auth";
import DataTable from "@/components/DataTable";
import Shell from "@/components/Shell";

const KIND_HE: Record<string, string> = { customer: "לקוח", owner: "בעל דירה", tzintuk: "צינתוק" };

export default async function Calls() {
  const { supabase, role, name } = await getSession(["admin", "agent"]);
  const { data } = await supabase.from("call_log")
    .select("id, direction, kind, phone, created_at, duration_s, recording_url, note, customer_id, customers(full_name), owners(name)")
    .order("created_at", { ascending: false }).limit(300);
  return (
    <Shell role={role} name={name}>
      <h1>תיעוד שיחות</h1>
      <div className="card">
        <DataTable
          filename="calls"
          columns={[
            { key: "when", label: "מתי" }, { key: "dir", label: "כיוון", filter: true }, { key: "kind", label: "סוג", filter: true },
            { key: "who", label: "מי" }, { key: "phone", label: "טלפון" }, { key: "dur", label: "משך" },
            { key: "note", label: "הערה" }, { key: "rec", label: "הקלטה" },
          ]}
          rows={(data ?? []).map((c: any) => ({
            id: c.id,
            cells: {
              when: { text: new Date(c.created_at).toLocaleString("he-IL", { timeZone: "Asia/Jerusalem" }) },
              dir: { text: c.direction === "in" ? "נכנסת" : "יוצאת" },
              kind: { text: KIND_HE[c.kind] ?? c.kind ?? "" },
              who: { text: c.customers?.full_name ?? c.owners?.name ?? "", node: c.customer_id ? <Link href={`/customers/${c.customer_id}`}>{c.customers?.full_name}</Link> : undefined },
              phone: { text: c.phone ?? "" },
              dur: { text: c.duration_s != null ? `${Math.floor(c.duration_s / 60)}:${String(c.duration_s % 60).padStart(2, "0")}` : "" },
              note: { text: c.note ?? "" },
              rec: { text: c.recording_url ? "יש" : "", node: c.recording_url ? <a href={c.recording_url} target="_blank" rel="noopener noreferrer">האזנה</a> : undefined },
            },
          }))}
          empty="עדיין אין שיחות מתועדות."
        />
      </div>
    </Shell>
  );
}
