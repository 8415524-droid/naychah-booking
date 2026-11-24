import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth";
import Shell from "@/components/Shell";
import { redirect } from "next/navigation";
import { adminClient } from "@/lib/supabase/admin";
import { ROLE_HE } from "@/lib/labels";

async function saveUser(fd: FormData) {
  "use server";
  const { supabase, user } = await getSession(["admin"]);
  const id = String(fd.get("id"));
  const role = String(fd.get("role"));
  if (id === user.id) return; // המנהל לא משנה לעצמו תפקיד
  if (!["admin", "agent", "owner", "partner", "vendor", "none"].includes(role)) return;
  const ownerId = role === "owner" ? String(fd.get("owner_id") || "") || null : null;
  await supabase.from("profiles").update({ role, owner_id: ownerId }).eq("id", id);
  revalidatePath("/users");
}

async function addUser(fd: FormData) {
  "use server";
  await getSession(["admin"]);
  const fullName = String(fd.get("full_name") ?? "").trim();
  const email = String(fd.get("email") ?? "").trim().toLowerCase();
  const password = String(fd.get("password") ?? "");
  const role = String(fd.get("role") ?? "none");
  const ownerId = role === "owner" ? String(fd.get("owner_id") || "") || null : null;
  const fail = (m: string) => redirect(`/users?err=${encodeURIComponent(m)}`);
  if (fullName.length < 2) fail("חסר שם");
  if (!/^\S+@\S+\.\S+$/.test(email)) fail("כתובת מייל לא תקינה");
  if (password.length < 8) fail("הסיסמה חייבת להיות לפחות 8 תווים");
  if (!["admin", "agent", "owner", "none"].includes(role)) fail("תפקיד לא תקין");
  if (role === "owner" && !ownerId) fail("בעל דירה חייב להיות מקושר לבעל דירה מהרשימה");
  const admin = adminClient();
  const { data, error } = await admin.auth.admin.createUser({
    email, password, email_confirm: true, user_metadata: { full_name: fullName },
  });
  if (error || !data.user) fail(error?.message?.includes("already") ? "המייל הזה כבר קיים" : "יצירת המשתמש נכשלה");
  const { error: pErr } = await admin.from("profiles").upsert(
    { id: data!.user!.id, role, owner_id: ownerId, full_name: fullName }, { onConflict: "id" });
  if (pErr) fail("המשתמש נוצר אך הקצאת התפקיד נכשלה. הגדר אותו ברשימה למטה");
  revalidatePath("/users");
  redirect("/users?ok=1");
}

export default async function Users({ searchParams }: { searchParams: Promise<{ ok?: string; err?: string }> }) {
  const sp = await searchParams;
  const { supabase, role, name, user } = await getSession(["admin"]);
  const { data: profiles } = await supabase.from("profiles").select("id, role, full_name, owner_id").order("created_at");
  const { data: owners } = await supabase.from("owners").select("id, name").order("name");
  return (
    <Shell role={role} name={name}>
      <h1>משתמשים</h1>
      <p className="muted">כאן מוסיפים משתמשים ומקצים להם תפקיד. בעל דירה חייב להיות מקושר לבעל דירה מהרשימה. משתמש חדש מקבל מייל וסיסמה ראשונית שתמסור לו.</p>
      {sp.ok && <p className="card" role="status">המשתמש נוסף.</p>}
      {sp.err && <p className="card" role="alert" style={{ color: "#b00020" }}>{sp.err}</p>}
      <details className="card">
        <summary><strong>הוספת משתמש</strong></summary>
        <form className="row" action={addUser}>
          <input name="full_name" placeholder="שם מלא" required />
          <input name="email" type="email" placeholder="מייל" required dir="ltr" />
          <input name="password" type="text" placeholder="סיסמה ראשונית (8 תווים לפחות)" required minLength={8} dir="ltr" autoComplete="off" />
          <select name="role" defaultValue="agent" style={{ width: "auto" }}>
            {Object.entries(ROLE_HE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <select name="owner_id" defaultValue="" style={{ width: "auto" }}>
            <option value="">— בעל דירה (רק לתפקיד בעל דירה) —</option>
            {owners?.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
          <button className="btn">הוספה</button>
        </form>
      </details>
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
