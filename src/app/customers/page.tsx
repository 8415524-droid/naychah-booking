import Link from "next/link";
import { getSession } from "@/lib/auth";
import Collapsible from "@/components/Collapsible";
import DataTable from "@/components/DataTable";
import Shell from "@/components/Shell";

export default async function Customers({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const { supabase, role, name } = await getSession(["admin", "agent"]);
  let query = supabase.from("customers").select("id, full_name, phone, created_at").order("created_at", { ascending: false }).limit(100);
  const term = (q ?? "").trim().replace(/[%,()]/g, "");
  if (term) query = query.or(`full_name.ilike.%${term}%,phone.ilike.%${term}%`);
  const { data } = await query;
  return (
    <Shell role={role} name={name}>
      <h1>לקוחות</h1>
      <Collapsible title="חיפוש לקוח" summary={q ? `מסונן: ${q}` : "לפי שם או טלפון"}>
        <form method="get">
          <label>חיפוש לפי שם או טלפון</label>
          <input name="q" defaultValue={q} />
          <button className="primary">חיפוש</button>
        </form>
      </Collapsible>
      <div className="card">
        <DataTable
          filename="customers"
          columns={[{ key: "name", label: "שם" }, { key: "phone", label: "טלפון" }, { key: "open", label: "" }]}
          rows={(data ?? []).map((c) => ({
            id: c.id,
            cells: { name: { text: c.full_name ?? "" }, phone: { text: c.phone ?? "" }, open: { text: "", node: <Link href={`/customers/${c.id}`}>כרטיס לקוח</Link> } },
          }))}
          empty="לא נמצאו לקוחות."
        />
      </div>
    </Shell>
  );
}
