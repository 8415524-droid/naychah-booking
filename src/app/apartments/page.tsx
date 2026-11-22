import Link from "next/link";
import { getSession } from "@/lib/auth";
import Shell from "@/components/Shell";

export default async function Apartments() {
  const { supabase, role, name } = await getSession(["admin", "agent", "owner"]);
  const { data: apts } = await supabase
    .from("apartments").select("id, name, beds, rooms, short_code, active, owners(name)").order("name");
  return (
    <Shell role={role} name={name}>
      <div className="row"><h1>דירות</h1>
        {role !== "agent" && <Link className="btn" href="/apartments/new">הוספת דירה</Link>}
      </div>
      <div className="card">
        <table>
          <thead><tr><th>#</th><th>דירה</th><th>בעלים</th><th>מיטות</th><th>חדרים</th><th></th></tr></thead>
          <tbody>
            {apts?.map((a: any) => (
              <tr key={a.id}>
                <td>{a.short_code}</td><td>{a.name}{!a.active && " (לא פעילה)"}</td>
                <td>{a.owners?.name}</td><td>{a.beds}</td><td>{a.rooms}</td>
                <td><Link href={`/apartments/${a.id}`}>{role === "agent" ? "צפייה" : "עריכה"}</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
        {!apts?.length && <p className="muted">עדיין אין דירות.</p>}
      </div>
    </Shell>
  );
}
