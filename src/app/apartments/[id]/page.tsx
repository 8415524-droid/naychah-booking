import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth";
import Shell from "@/components/Shell";
import ApartmentFields, { parseApartment } from "@/components/ApartmentFields";
import { PERIOD_HE } from "@/lib/labels";

async function saveApartment(fd: FormData) {
  "use server";
  const { supabase, role } = await getSession(["admin", "owner"]);
  const id = String(fd.get("id"));
  const { error } = await supabase.from("apartments").update({ ...parseApartment(fd), active: fd.get("active") === "on" }).eq("id", id);
  void role;
  if (error) redirect(`/apartments/${id}?err=` + encodeURIComponent(error.message.includes("short_code") ? "מספר הדירה הקצר כבר בשימוש" : "שגיאה בשמירה"));
  revalidatePath(`/apartments/${id}`);
  redirect(`/apartments/${id}?saved=1`);
}

async function addRule(fd: FormData) {
  "use server";
  const { supabase } = await getSession(["admin", "owner"]);
  const apartment_id = String(fd.get("apartment_id"));
  const period_type = String(fd.get("period_type"));
  const early = Number(fd.get("price_early"));
  const late = fd.get("price_late") ? Number(fd.get("price_late")) : early;
  await supabase.from("pricing_rules").insert({
    apartment_id, period_type,
    label: String(fd.get("label") || "") || null,
    valid_from: period_type === "special" ? String(fd.get("valid_from") || "") || null : null,
    valid_to: period_type === "special" ? String(fd.get("valid_to") || "") || null : null,
    price_early: early, price_late: late,
  });
  revalidatePath(`/apartments/${apartment_id}`);
}

async function deleteRule(fd: FormData) {
  "use server";
  const { supabase } = await getSession(["admin", "owner"]);
  await supabase.from("pricing_rules").delete().eq("id", String(fd.get("id")));
  revalidatePath(`/apartments/${String(fd.get("apartment_id"))}`);
}

export default async function Apartment({ params, searchParams }: {
  params: Promise<{ id: string }>; searchParams: Promise<{ err?: string; saved?: string }>;
}) {
  const { id } = await params;
  const { err, saved } = await searchParams;
  const { supabase, role, name } = await getSession(["admin", "agent", "owner"]);
  const { data: apt } = await supabase.from("apartments").select("*, owners(name)").eq("id", id).single();
  if (!apt) notFound();
  const { data: rules } = await supabase.from("pricing_rules").select("*").eq("apartment_id", id).order("period_type");
  const canEdit = role !== "agent";

  return (
    <Shell role={role} name={name}>
      <h1>{apt.name} <span className="muted">· {apt.owners?.name}</span></h1>

      {canEdit ? (
        <form className="card" action={saveApartment}>
          <input type="hidden" name="id" value={id} />
          <ApartmentFields apt={apt} />
          <label className="checks"><input type="checkbox" name="active" defaultChecked={apt.active} /> דירה פעילה (מופיעה בחיפוש)</label>
          {err && <p className="err">{err}</p>}
          {saved && <p className="ok">נשמר</p>}
          <button className="primary">שמירת פרטי הדירה</button>
        </form>
      ) : (
        <div className="card">
          <p>{apt.beds} מיטות · {apt.rooms ?? "?"} חדרים · {apt.address}</p>
          <p>{apt.features?.join(", ")}</p>
          <p>{apt.onsite_contact}</p>
          <p>{apt.notes}</p>
        </div>
      )}

      <div className="card">
        <h2>מחירים</h2>
        <p className="muted">מחיר מוזל חל כשסוגרים עד שעת הסף של הדירה. מחיר רגיל חל אחרי כן (למשל ביום שישי). לתקופה בלי הבדל, השאר את המחיר הרגיל ריק.</p>
        <table>
          <thead><tr><th>תקופה</th><th>תאריכים</th><th>מחיר מוזל</th><th>מחיר רגיל</th><th></th></tr></thead>
          <tbody>
            {rules?.map((r) => (
              <tr key={r.id}>
                <td>{PERIOD_HE[r.period_type]}{r.label ? ` · ${r.label}` : ""}</td>
                <td>{r.valid_from ? `${r.valid_from} עד ${r.valid_to ?? ""}` : "—"}</td>
                <td>{r.price_early} ₪</td><td>{r.price_late} ₪</td>
                <td>{canEdit && (
                  <form action={deleteRule}><input type="hidden" name="id" value={r.id} /><input type="hidden" name="apartment_id" value={id} /><button className="danger">מחיקה</button></form>
                )}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!rules?.length && <p className="muted">עדיין לא הוגדרו מחירים.</p>}
        {canEdit && (
          <form action={addRule} style={{ marginTop: 16 }}>
            <input type="hidden" name="apartment_id" value={id} />
            <div className="grid2">
              <div><label>סוג תקופה</label>
                <select name="period_type" defaultValue="thu_sat">
                  {Object.entries(PERIOD_HE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select></div>
              <div><label>שם (לתקופה מיוחדת)</label><input name="label" placeholder='למשל ל"ג בעומר' /></div>
              <div><label>מתאריך (לתקופה מיוחדת)</label><input type="date" name="valid_from" /></div>
              <div><label>עד תאריך</label><input type="date" name="valid_to" /></div>
              <div><label>מחיר מוזל (₪)</label><input type="number" name="price_early" min={0} required /></div>
              <div><label>מחיר רגיל (₪)</label><input type="number" name="price_late" min={0} /></div>
            </div>
            <button className="primary">הוספת מחיר</button>
          </form>
        )}
      </div>
    </Shell>
  );
}
