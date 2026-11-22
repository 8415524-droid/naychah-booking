import Link from "next/link";
import { getSession } from "@/lib/auth";
import Shell from "@/components/Shell";

export default async function Home() {
  const { supabase, role, name } = await getSession();
  const { count } = await supabase.from("apartments").select("id", { count: "exact", head: true });
  return (
    <Shell role={role} name={name}>
      {role === "none" ? (
        <div className="card">החשבון שלך עדיין לא קיבל הרשאה. פנה למנהל.</div>
      ) : (
        <div className="card">
          <h2>שלום {name}</h2>
          <p>דירות במערכת: <strong>{count ?? 0}</strong></p>
          {role !== "owner" && <Link className="btn" href="/search">חיפוש דירה ללקוח</Link>}{" "}
          <Link className="btn" href="/apartments">לניהול הדירות</Link>
        </div>
      )}
    </Shell>
  );
}
