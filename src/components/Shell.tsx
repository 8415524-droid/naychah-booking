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
          <Link href="/" className="brand"><span className="logo-tile"><img src="/logo-full.webp" width={72} height={44} alt="נייחא" /></span></Link>
          {(role === "admin" || role === "agent") && <Link href="/search">חיפוש</Link>}
          {role !== "none" && <Link href="/bookings">הזמנות</Link>}
          {(role === "admin" || role === "agent") && <Link href="/customers">לקוחות</Link>}
          {role === "admin" && <Link href="/reports">דוחות</Link>}
          {role !== "none" && <Link href="/apartments">דירות</Link>}
          {role === "admin" && <Link href="/owners">בעלי דירות</Link>}
          {role === "admin" && <Link href="/users">משתמשים</Link>}
          {role === "admin" && <Link href="/settings">הגדרות</Link>}
        </nav>
        <form action={logout}>
          <span className="who">{name} · {ROLE_HE[role]}</span> <button>יציאה</button>
        </form>
      </header>
      <main>{children}</main>
    </>
  );
}
