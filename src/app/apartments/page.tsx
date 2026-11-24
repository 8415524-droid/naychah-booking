import Link from "next/link";
import { getSession } from "@/lib/auth";
import DataTable from "@/components/DataTable";
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
        <DataTable
          filename="apartments"
          columns={[
            { key: "code", label: "#" }, { key: "name", label: "דירה" }, { key: "owner", label: "בעלים", filter: true },
            { key: "beds", label: "מיטות", filter: true }, { key: "rooms", label: "חדרים", filter: true }, { key: "open", label: "" },
          ]}
          rows={(apts ?? []).map((a: any) => ({
            id: a.id,
            cells: {
              code: { text: String(a.short_code ?? "") },
              name: { text: `${a.name}${!a.active ? " (לא פעילה)" : ""}` },
              owner: { text: a.owners?.name ?? "" },
              beds: { text: String(a.beds ?? "") },
              rooms: { text: String(a.rooms ?? "") },
              open: { text: "", node: <Link href={`/apartments/${a.id}`}>{role === "agent" ? "צפייה" : "עריכה"}</Link> },
            },
          }))}
          empty="עדיין אין דירות."
        />
      </div>
    </Shell>
  );
}
