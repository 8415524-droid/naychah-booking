import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth";
import Shell from "@/components/Shell";

async function addOwner(fd: FormData) {
  "use server";
  const { supabase } = await getSession(["admin"]);
  const name = String(fd.get("name") || "").trim();
  if (!name) return;
  await supabase.from("owners").insert({
    name,
    phone: String(fd.get("phone") || "") || null,
    callback_phone: String(fd.get("callback_phone") || "") || null,
    pin: String(fd.get("pin") || "") || null,
    calendar_synced: fd.get("calendar_synced") === "on",
  });
  revalidatePath("/owners");
}

async function deleteOwner(fd: FormData) {
  "use server";
  const { supabase } = await getSession(["admin"]);
  await supabase.from("owners").delete().eq("id", String(fd.get("id")));
  revalidatePath("/owners");
}

export default async function Owners() {
  const { supabase, role, name } = await getSession(["admin"]);
  const { data: owners } = await supabase.from("owners").select("*").order("name");
  return (
    <Shell role={role} name={name}>
      <h1>בעלי דירות</h1>
      <form className="card" action={addOwner}>
        <h2>הוספת בעל דירה</h2>
        <div className="grid2">
          <div><label>שם</label><input name="name" required /></div>
          <div><label>טלפון</label><input name="phone" inputMode="tel" /></div>
          <div><label>טלפון לצינתוק</label><input name="callback_phone" inputMode="tel" /></div>
          <div><label>קוד PIN למרכזייה</label><input name="pin" inputMode="numeric" /></div>
        </div>
        <label className="checks"><input type="checkbox" name="calendar_synced" /> היומן שלו מסונכרן</label>
        <button className="primary">הוספה</button>
      </form>
      <div className="card">
        <table>
          <thead><tr><th>שם</th><th>טלפון</th><th>צינתוק</th><th>יומן מסונכרן</th><th></th></tr></thead>
          <tbody>
            {owners?.map((o) => (
              <tr key={o.id}>
                <td>{o.name}</td><td>{o.phone}</td><td>{o.callback_phone}</td>
                <td>{o.calendar_synced ? "כן" : "לא"}</td>
                <td><form action={deleteOwner}><input type="hidden" name="id" value={o.id} /><button className="danger">מחיקה</button></form></td>
              </tr>
            ))}
          </tbody>
        </table>
        {!owners?.length && <p className="muted">עדיין אין בעלי דירות.</p>}
      </div>
    </Shell>
  );
}
