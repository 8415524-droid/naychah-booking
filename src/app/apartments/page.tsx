import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { locateApartment, locateMissing } from "@/lib/locate";
import Link from "next/link";
import { getSession } from "@/lib/auth";
import Collapsible from "@/components/Collapsible";
import DataTable from "@/components/DataTable";
import Shell from "@/components/Shell";

async function locateMissingNow() {
  "use server";
  const { supabase } = await getSession(["admin"]);
  const { data } = await supabase.from("apartments").select("id, address, lat, lng, walk_minutes").is("walk_minutes", null).not("address", "is", null).limit(6);
  let done = 0, failed = 0;
  for (const a of data ?? []) {
    const r = await locateApartment(supabase, a);
    if (r.ok) done++; else failed++;
    await new Promise((res) => setTimeout(res, 1100)); // מגבלת השירות החופשי: בקשה לשנייה
  }
  revalidatePath("/apartments");
  redirect(`/apartments?located=${done}&failed=${failed}`);
}

export default async function Apartments({ searchParams }: { searchParams: Promise<{ located?: string; failed?: string }> }) {
  const sp = await searchParams;
  // איתור אוטומטי ברקע של דירות שטרם אותרו (למנהל בלבד, כי רק לו יש הרשאת עדכון)
  const { supabase, role, name } = await getSession(["admin", "agent", "owner"]);
  if (role === "admin") after(async () => { await locateMissing(supabase, 6); });
  const { data: apts } = await supabase
    .from("apartments").select("*, owners(name)").order("name");
  return (
    <Shell role={role} name={name}>
      <div className="row"><h1>דירות</h1>
        {role !== "agent" && <Link className="btn" href="/apartments/new">הוספת דירה</Link>}
      </div>
      {role === "admin" && (
        <Collapsible title="מיקום הדירות" summary={`${(apts ?? []).filter((a: any) => a.walk_minutes != null).length} מתוך ${apts?.length ?? 0} אותרו`}>
          {sp.located !== undefined && <p className="ok">אותרו {sp.located} דירות{Number(sp.failed) > 0 && `, ${sp.failed} לא הצליחו (בדוק כתובת בדף הדירה)`}.</p>}
          <p className="muted">הדירות מאותרות אוטומטית לפי הכתובת (עד 6 בכל כניסה לעמוד). אם משהו תקוע, אפשר להפעיל ידנית.</p>
          <form action={locateMissingNow}><button className="btn">אתר דירות שטרם אותרו</button></form>
        </Collapsible>
      )}
      <div className="card">
        <DataTable
          filename="apartments"
          columns={[
            { key: "code", label: "#" }, { key: "name", label: "דירה" }, { key: "owner", label: "בעלים", filter: true },
            { key: "beds", label: "מיטות", filter: true }, { key: "rooms", label: "חדרים", filter: true }, { key: "walk", label: "הליכה לציון", filter: true }, { key: "open", label: "" },
          ]}
          rows={(apts ?? []).map((a: any) => ({
            id: a.id,
            cells: {
              code: { text: String(a.short_code ?? "") },
              name: { text: `${a.name}${!a.active ? " (לא פעילה)" : ""}` },
              owner: { text: a.owners?.name ?? "" },
              beds: { text: String(a.beds ?? "") },
              rooms: { text: String(a.rooms ?? "") },
              walk: { text: a.walk_minutes != null ? `${a.walk_minutes} דק'` : "לא אותרה" },
              open: { text: "", node: <Link href={`/apartments/${a.id}`}>{role === "agent" ? "צפייה" : "עריכה"}</Link> },
            },
          }))}
          empty="עדיין אין דירות."
        />
      </div>
    </Shell>
  );
}
