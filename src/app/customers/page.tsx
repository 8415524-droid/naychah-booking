import Link from "next/link";
import { getSession } from "@/lib/auth";
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
      <form className="card" method="get">
        <label>חיפוש לפי שם או טלפון</label>
        <input name="q" defaultValue={q} />
        <button className="primary">חיפוש</button>
      </form>
      <div className="card">
        <table>
          <thead><tr><th>שם</th><th>טלפון</th><th></th></tr></thead>
          <tbody>{data?.map((c) => <tr key={c.id}><td>{c.full_name}</td><td>{c.phone}</td><td><Link href={`/customers/${c.id}`}>כרטיס לקוח</Link></td></tr>)}</tbody>
        </table>
        {!data?.length && <p className="muted">לא נמצאו לקוחות.</p>}
      </div>
    </Shell>
  );
}
