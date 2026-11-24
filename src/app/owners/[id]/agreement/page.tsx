import { notFound } from "next/navigation";
import { getSession } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import PrintButton from "@/components/PrintButton";
import { buildAgreement } from "@/lib/agreement";

async function saveAgreement(fd: FormData) {
  "use server";
  const { supabase } = await getSession(["admin"]);
  const owner_id = String(fd.get("owner_id"));
  await supabase.from("owner_agreements").upsert({
    owner_id, id_number: String(fd.get("id_number") || "") || null, address: String(fd.get("address") || "") || null, email: String(fd.get("email") || "") || null,
    starts_on: String(fd.get("starts_on") || "") || null, ends_on: String(fd.get("ends_on") || "") || null,
    commission_pct: Number(fd.get("commission_pct")) || 0, notice_days: Number(fd.get("notice_days")) || 0, signed: fd.get("signed") === "on", notes: String(fd.get("notes") || "") || null,
  });
  revalidatePath(`/owners/${owner_id}/agreement`);
}

// טיוטת הסכם שיווק לבעל דירה להדפסה. הנוסח הועתק מהמערכת הישנה ועדיין דורש אישור עורך דין.
export default async function Agreement({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ idno?: string; addr?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const { supabase } = await getSession(["admin"]);
  const [{ data: o }, { data: st }] = await Promise.all([
    supabase.from("owners").select("name, phone").eq("id", id).single(),
    supabase.from("settings").select("key, value").in("key", ["company_name", "company_id", "company_address", "company_phone"]),
  ]);
  if (!o) notFound();
  const { data: ag } = await supabase.from("owner_agreements").select("*").eq("owner_id", id).maybeSingle();
  const daysLeft = ag?.ends_on ? Math.round((new Date(ag.ends_on + "T12:00:00").getTime() - Date.now()) / 864e5) : null;
  const s = (k: string) => String((st ?? []).find((r) => r.key === k)?.value ?? "");
  const dateText = new Date().toLocaleDateString("he-IL", { timeZone: "Asia/Jerusalem", day: "numeric", month: "long", year: "numeric" });
  const lines = buildAgreement(
    { name: o.name, phone: o.phone ?? "", idno: sp.idno ?? ag?.id_number ?? undefined, addr: sp.addr ?? ag?.address ?? undefined },
    { name: s("company_name") || "נייחא", idno: s("company_id"), addr: s("company_address"), phone: s("company_phone") },
    dateText,
  );
  return (
    <div className="agr">
      <style>{`
        .agr{max-width:780px;margin:16px auto;background:#fff;color:#14233a;border-radius:12px;padding:30px 36px;font:15.5px/1.7 Arial,sans-serif;direction:rtl}
        .agr p{margin:3px 0;min-height:1em}.agr .draft{background:#fff3d6;border:1px solid #e0b64a;border-radius:8px;padding:8px 12px;margin-bottom:14px;font-size:14px}
        .agr form{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px}.agr input{background:#fff;color:#14233a;border:1px solid #ccc;width:auto}
        @media print{header.top,.side,.print-hide{display:none!important}body{background:#fff}.agr{margin:0;max-width:none;padding:0}}
      `}</style>
      <div className="print-hide">
        <div className="draft">טיוטה בלבד. הנוסח הועתק מהמערכת הישנה (כולל אחוזי עמלה ומקדמה) ויש לאשר אותו מול עורך דין לפני חתימה.</div>
        <form action={saveAgreement} style={{ display: "block" }}>
          <input type="hidden" name="owner_id" value={id} />
          <p>{ag ? (daysLeft == null ? "אין תאריך סיום" : daysLeft < 0 ? `פג תוקף לפני ${-daysLeft} ימים` : `בתוקף עוד ${daysLeft} ימים`) : "עדיין לא נשמרו פרטי הסכם"}{ag?.signed ? " · נחתם" : ""}</p>
          <input name="id_number" placeholder="ת.ז. / ח.פ" defaultValue={ag?.id_number ?? ""} /> <input name="address" placeholder="כתובת" defaultValue={ag?.address ?? ""} /> <input name="email" placeholder="אימייל" defaultValue={ag?.email ?? ""} />
          <input type="date" name="starts_on" defaultValue={ag?.starts_on ?? ""} title="תחילה" /> <input type="date" name="ends_on" defaultValue={ag?.ends_on ?? ""} title="סיום" />
          <input type="number" name="commission_pct" defaultValue={ag?.commission_pct ?? 10} title="עמלה %" style={{ width: 80 }} /> <input type="number" name="notice_days" defaultValue={ag?.notice_days ?? 30} title="ימי הודעה" style={{ width: 80 }} />
          <label><input type="checkbox" name="signed" defaultChecked={!!ag?.signed} style={{ width: "auto" }} /> נחתם</label> <input name="notes" placeholder="הערות" defaultValue={ag?.notes ?? ""} />
          <button className="btn">שמירת פרטי הסכם</button>
        </form>
        <form method="get">
          <input name="idno" placeholder="ת.ז. / ח.פ של בעל הנכס" defaultValue={sp.idno} />
          <input name="addr" placeholder="כתובת בעל הנכס" defaultValue={sp.addr} />
          <button className="btn">עדכון</button> <PrintButton />
        </form>
      </div>
      {lines.map((l, i) => <p key={i} style={/^\d+\.\s/.test(l) && !/^\d+\.\d/.test(l) ? { fontWeight: 700, marginTop: 12 } : undefined}>{l}</p>)}
    </div>
  );
}
