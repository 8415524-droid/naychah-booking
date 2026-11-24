import Link from "next/link";
import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth";
import Shell from "@/components/Shell";
import { nowInJerusalem } from "@/lib/pricing";
import { queryFrom, runSearch } from "@/lib/search-run";
import { fmtDate } from "@/lib/weekends";

async function closeRequest(fd: FormData) {
  "use server";
  const { supabase } = await getSession(["admin", "agent"]);
  await supabase.from("search_waitlist").update({ status: "closed" }).eq("id", String(fd.get("id")));
  revalidatePath("/waitlist");
}

export default async function Waitlist() {
  const { supabase, role, name } = await getSession(["admin", "agent"]);
  const now = nowInJerusalem();
  const today = now.slice(0, 10);
  const { data: reqs } = await supabase.from("search_waitlist").select("*")
    .eq("status", "open").gte("check_out", today).order("check_in").limit(40);

  const rows = await Promise.all((reqs ?? []).map(async (w) => {
    const sp = Object.fromEntries(new URLSearchParams(w.params)) as Record<string, string>;
    const out = await runSearch(supabase, queryFrom(sp), { checkIn: w.check_in, checkOut: w.check_out }, "best", now);
    return { w, exact: out.exact.length, names: out.exact.slice(0, 3).map((r) => r.apt.name) };
  }));
  rows.sort((a, b) => Number(b.exact > 0) - Number(a.exact > 0));

  return (
    <Shell role={role} name={name}>
      <h1>רשימת המתנה</h1>
      <p className="muted">בקשות שלא נמצאה להן דירה. בכל כניסה לעמוד נבדק מחדש אם התפנתה דירה שעונה על כל הדרישות.</p>
      {rows.length === 0 && <div className="card">אין בקשות ממתינות.</div>}
      {rows.map(({ w, exact, names }) => (
        <div key={w.id} className={`card${exact ? "" : " near"}`}>
          <div className="row">
            <h2 style={{ margin: 0 }}>{w.customer_name} · {w.customer_phone}</h2>
            <div className="muted">{fmtDate(w.check_in)} עד {fmtDate(w.check_out)}{w.guests ? ` · ${w.guests} מיטות` : ""}</div>
          </div>
          {exact > 0
            ? <p><span className="tag ok">✓ התפנו {exact} דירות מתאימות</span> {names.join(" · ")}</p>
            : <p className="muted">עדיין אין דירה מתאימה</p>}
          <div className="row">
            <Link href={`/search?${w.params}&cust_phone=${encodeURIComponent(w.customer_phone)}`}>פתח את החיפוש</Link>
            <form action={closeRequest}><input type="hidden" name="id" value={w.id} /><button>סגור בקשה</button></form>
          </div>
        </div>
      ))}
    </Shell>
  );
}
