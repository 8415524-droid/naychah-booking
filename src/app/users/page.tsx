import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth";
import Shell from "@/components/Shell";
import { ROLE_HE } from "@/lib/labels";

async function saveUser(fd: FormData) {
  "use server";
  const { supabase, user } = await getSession(["admin"]);
  const id = String(fd.get("id"));
  const role = String(fd.get("role"));
  if (id === user.id) return; // המנהל לא משנה לעצמו תפקיד
  if (!["admin", "agent", "owner", "none"].includes(role)) return;
  const ownerId = role === "owner" ? String(fd.get("owner_id") || "") || null : null;
  await supabase.from("profiles").update({ role, owner_id: ownerId }).eq("id", id);
  revalidatePath("/users");
}

export default async function Users() {
  const { supabase, role, name, user } = await getSession(["admin"]);
  const { data: profiles } = await supabase.from("profiles").select("id, role, full_name, owner_id").order("created_at");
  const { data: owners } = await supabase.from("owners").select("id, name").order("name");
  return (
    <Shell role={role} name={name}>
      <h1>משתמשים</h1>
      <p className="muted">משתמשים חדשים נוצרים ב-Supabase (Authentication → Users). כאן מקצים להם תפקיד. בעל דירה חייב להיות מקושר לבעל דירה מהרשימה.</p>
      {profiles?.map((p) => (
        <form key={p.id} className="card row" action={saveUser}>
          <input type="hidden" name="id" value={p.id} />
          <strong>{p.full_name}</strong>
          {p.id === user.id ? (
            <span>{ROLE_HE[p.role]} (אתה)</span>
          ) : (
            <>
              <select name="role" defaultValue={p.role} style={{ width: "auto" }}>
                {Object.entries(ROLE_HE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
              <select name="owner_id" defaultValue={p.owner_id ?? ""} style={{ width: "auto" }}>
                <option value="">— בעל דירה (רק לתפקיד בעל דירה) —</option>
                {owners?.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
              <button className="btn">שמירה</button>
            </>
          )}
        </form>
      ))}
    </Shell>
  );
}
