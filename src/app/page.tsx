import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

const ROLE_HE: Record<string, string> = { admin: "מנהל", agent: "טלפנית", owner: "בעל דירה", none: "ללא הרשאה" };

async function logout() {
  "use server";
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export default async function Home() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase.from("profiles").select("role, full_name").eq("id", user!.id).single();
  const role = profile?.role ?? "none";
  const { data: apartments } = await supabase.from("apartments").select("id, name, beds").order("name");

  return (
    <>
      <header className="top">
        <strong>נייחא</strong>
        <form action={logout}><button>יציאה</button></form>
      </header>
      <main>
        <div className="card">
          שלום {profile?.full_name ?? user!.email}. תפקיד: <strong>{ROLE_HE[role]}</strong>
        </div>
        {role === "none" ? (
          <div className="card">החשבון שלך עדיין לא קיבל הרשאה. פנה למנהל.</div>
        ) : (
          <div className="card">
            <h2>דירות ({apartments?.length ?? 0})</h2>
            <ul>{apartments?.map((a) => <li key={a.id}>{a.name} · {a.beds} מיטות</li>)}</ul>
          </div>
        )}
      </main>
    </>
  );
}
