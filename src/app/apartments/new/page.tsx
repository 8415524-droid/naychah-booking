import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import Shell from "@/components/Shell";
import ApartmentFields, { parseApartment } from "@/components/ApartmentFields";

async function createApartment(fd: FormData) {
  "use server";
  const { supabase, role, ownerId } = await getSession(["admin", "owner"]);
  const owner_id = role === "owner" ? ownerId : String(fd.get("owner_id") || "");
  if (!owner_id) return;
  const { data, error } = await supabase.from("apartments").insert({ ...parseApartment(fd), owner_id }).select("id").single();
  if (error) redirect("/apartments/new?err=" + encodeURIComponent(error.message.includes("short_code") ? "מספר הדירה הקצר כבר בשימוש" : "שגיאה בשמירה"));
  redirect(`/apartments/${data.id}`);
}

export default async function NewApartment({ searchParams }: { searchParams: Promise<{ err?: string }> }) {
  const { err } = await searchParams;
  const { supabase, role, name } = await getSession(["admin", "owner"]);
  const { data: owners } = role === "admin" ? await supabase.from("owners").select("id, name").order("name") : { data: null };
  return (
    <Shell role={role} name={name}>
      <h1>הוספת דירה</h1>
      <form className="card" action={createApartment}>
        {role === "admin" && (
          <>
            <label>בעל הדירה</label>
            <select name="owner_id" required defaultValue="">
              <option value="" disabled>בחר…</option>
              {owners?.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          </>
        )}
        <ApartmentFields apt={null} />
        {err && <p className="err">{err}</p>}
        <button className="primary">שמירה והמשך למחירים</button>
      </form>
    </Shell>
  );
}
