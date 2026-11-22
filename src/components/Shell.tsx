import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { ROLE_HE } from "@/lib/labels";
import type { Role } from "@/lib/auth";

async function logout() {
  "use server";
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export default function Shell({ role, name, children }: { role: Role; name: string; children: React.ReactNode }) {
  return (
    <>
      <header className="top">
        <nav className="nav">
          <Link href="/"><strong>נייחא</strong></Link>
          {role !== "none" && <Link href="/apartments">דירות</Link>}
          {role === "admin" && <Link href="/owners">בעלי דירות</Link>}
          {role === "admin" && <Link href="/users">משתמשים</Link>}
        </nav>
        <form action={logout}>
          <span className="who">{name} · {ROLE_HE[role]}</span> <button>יציאה</button>
        </form>
      </header>
      <main>{children}</main>
    </>
  );
}
