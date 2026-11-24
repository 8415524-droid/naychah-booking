import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { ROLE_HE } from "@/lib/labels";
import type { Role } from "@/lib/auth";
import Sidebar from "@/components/Sidebar";
import GlobalSearch from "@/components/GlobalSearch";
import MenuButton from "@/components/MenuButton";
import { navGroups } from "@/lib/nav";

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
        <div className="top-start">
          <MenuButton />
          <Link href="/" className="brand"><span className="logo-tile"><img src="/logo-full.webp" width={72} height={44} alt="נייחא" /></span></Link>
        </div>
        <GlobalSearch />
        <form action={logout}>
          <span className="who">{name} · {ROLE_HE[role]}</span> <button>יציאה</button>
        </form>
      </header>
      <div className="app">
        <Sidebar groups={navGroups(role)} />
        <main>{children}</main>
      </div>
    </>
  );
}
