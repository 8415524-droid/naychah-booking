import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth";
import Collapsible from "@/components/Collapsible";
import DataTable from "@/components/DataTable";
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

async function deleteOwners(ids: string[]) {
  "use server";
  const { supabase } = await getSession(["admin"]);
  if (ids.length) await supabase.from("owners").delete().in("id", ids);
  revalidatePath("/owners");
}

export default async function Owners() {
  const { supabase, role, name } = await getSession(["admin"]);
  const { data: owners } = await supabase.from("owners").select("*").order("name");
  return (
    <Shell role={role} name={name}>
      <h1>בעלי דירות</h1>
      <Collapsible title="הוספת בעל דירה" summary="שם, טלפון, צינתוק ו-PIN">
        <form action={addOwner}>
          <div className="grid2">
            <div><label>שם</label><input name="name" required /></div>
            <div><label>טלפון</label><input name="phone" inputMode="tel" /></div>
            <div><label>טלפון לצינתוק</label><input name="callback_phone" inputMode="tel" /></div>
            <div><label>קוד PIN למרכזייה</label><input name="pin" inputMode="numeric" /></div>
          </div>
          <label className="checks"><input type="checkbox" name="calendar_synced" /> היומן שלו מסונכרן</label>
          <button className="primary">הוספה</button>
        </form>
      </Collapsible>
      <div className="card">
        <DataTable
          filename="owners"
          columns={[
            { key: "name", label: "שם" }, { key: "phone", label: "טלפון" }, { key: "cb", label: "צינתוק" },
            { key: "sync", label: "יומן מסונכרן", filter: true }, { key: "del", label: "" },
          ]}
          rows={(owners ?? []).map((o) => ({
            id: o.id,
            cells: {
              name: { text: o.name ?? "" }, phone: { text: o.phone ?? "" }, cb: { text: o.callback_phone ?? "" },
              sync: { text: o.calendar_synced ? "כן" : "לא" },
              del: { text: "", node: <form action={deleteOwner}><input type="hidden" name="id" value={o.id} /><button className="danger">מחיקה</button></form> },
            },
          }))}
          bulkAction={{ label: "מחיקת הנבחרים", confirm: "למחוק את בעלי הדירות שנבחרו?", run: deleteOwners }}
          empty="עדיין אין בעלי דירות."
        />
      </div>
    </Shell>
  );
}
