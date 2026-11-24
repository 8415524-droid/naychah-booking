import { notFound } from "next/navigation";
import { getSession } from "@/lib/auth";
import PrintButton from "@/components/PrintButton";
import { buildAgreement } from "@/lib/agreement";

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
  const s = (k: string) => String((st ?? []).find((r) => r.key === k)?.value ?? "");
  const dateText = new Date().toLocaleDateString("he-IL", { timeZone: "Asia/Jerusalem", day: "numeric", month: "long", year: "numeric" });
  const lines = buildAgreement(
    { name: o.name, phone: o.phone ?? "", idno: sp.idno, addr: sp.addr },
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
