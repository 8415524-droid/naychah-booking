import { notFound } from "next/navigation";
import { getSession } from "@/lib/auth";
import PrintButton from "@/components/PrintButton";
import { fmtDate } from "@/lib/weekends";

const METHOD_HE: Record<string, string> = { credit: "אשראי", transfer: "העברה בנקאית", cash: "מזומן", other: "אחר" };

// קבלה להדפסה / שמירה כ-PDF. פרטי החברה נלקחים מההגדרות.
export default async function Receipt({ params }: { params: Promise<{ id: string; no: string }> }) {
  const { id, no } = await params;
  const { supabase } = await getSession(["admin", "agent"]);
  const [{ data: p }, { data: b }, { data: st }] = await Promise.all([
    supabase.from("payments").select("*").eq("booking_id", id).eq("receipt_no", Number(no)).single(),
    supabase.from("bookings").select("check_in, check_out, apartments(name), customers(full_name, phone)").eq("id", id).single(),
    supabase.from("settings").select("key, value").in("key", ["company_name", "company_id", "company_address", "company_phone"]),
  ]);
  if (!p || !b) notFound();
  const s = (k: string) => String((st ?? []).find((r) => r.key === k)?.value ?? "");
  const when = new Date(p.created_at);
  const bb = b as any;
  return (
    <div className="receipt">
      <style>{`
        .receipt{max-width:640px;margin:20px auto;background:#fff;color:#14233a;border-radius:14px;padding:28px 30px;font-family:Arial,sans-serif;direction:rtl}
        .receipt h1{margin:14px 0 2px;font-size:26px;text-shadow:none}.receipt dl{display:grid;grid-template-columns:130px 1fr;gap:8px 12px}
        .receipt dd{margin:0;font-weight:600}.receipt .amt{margin:16px 0;padding:14px 18px;background:#f6f1e3;border-radius:10px;font-size:22px;font-weight:800;display:flex;justify-content:space-between}
        .receipt .co{border-bottom:2px solid #c29a52;padding-bottom:12px}.receipt .foot{font-size:12.5px;color:#667;margin-top:18px;border-top:1px solid #e3e3e3;padding-top:10px}
        @media print{header.top,.side,.print-hide{display:none!important}body{background:#fff}.receipt{margin:0;max-width:none}}
      `}</style>
      <div className="co"><strong style={{ fontSize: 20 }}>{s("company_name") || "נייחא"}</strong>
        {s("company_id") && <div>ח.פ {s("company_id")}</div>}{s("company_address") && <div>{s("company_address")}</div>}{s("company_phone") && <div>טלפון {s("company_phone")}</div>}
      </div>
      <h1>קבלה מספר {p.receipt_no}</h1>
      <div>תאריך {fmtDate(when.toLocaleDateString("en-CA", { timeZone: "Asia/Jerusalem" }))} · {when.toLocaleTimeString("he-IL", { timeZone: "Asia/Jerusalem", hour: "2-digit", minute: "2-digit" })}</div>
      <dl>
        <dt>התקבל מאת</dt><dd>{bb.customers?.full_name}</dd>
        <dt>עבור</dt><dd>מקדמה לאירוח: {bb.apartments?.name}</dd>
        <dt>תאריכי שהייה</dt><dd>{fmtDate(bb.check_in)} עד {fmtDate(bb.check_out)}</dd>
        <dt>אמצעי תשלום</dt><dd>{METHOD_HE[p.method] ?? p.method}{p.reference ? ` · אסמכתא ${p.reference}` : ""}</dd>
      </dl>
      <div className="amt"><span>סכום שהתקבל</span><span>{p.amount.toLocaleString()} ₪</span></div>
      <div className="foot">מסמך זה הופק אוטומטית ונשמר במערכת. תודה שבחרתם בנייחא.</div>
      <p style={{ textAlign: "center" }}><PrintButton /></p>
    </div>
  );
}
