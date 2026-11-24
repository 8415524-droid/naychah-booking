import { notFound } from "next/navigation";
import { getSession } from "@/lib/auth";
import PrintButton from "@/components/PrintButton";
import { fmtDate } from "@/lib/weekends";

// קבלת זיכוי להדפסה. מתייחסת לקבלה המקורית ואינה משנה אותה.
export default async function Credit({ params }: { params: Promise<{ id: string; no: string }> }) {
  const { id, no } = await params;
  const { supabase } = await getSession(["admin", "agent"]);
  const [{ data: c }, { data: b }, { data: st }] = await Promise.all([
    supabase.from("credit_notes").select("*, payments(receipt_no, booking_id)").eq("number", Number(no)).single(),
    supabase.from("bookings").select("check_in, check_out, apartments(name), customers(full_name)").eq("id", id).single(),
    supabase.from("settings").select("key, value").in("key", ["company_name", "company_id", "company_address", "company_phone"]),
  ]);
  const cc = c as any;
  if (!cc || !b || cc.payments?.booking_id !== id) notFound();
  const s = (k: string) => String((st ?? []).find((r) => r.key === k)?.value ?? "");
  const bb = b as any;
  return (
    <div className="receipt">
      <style>{`.receipt{max-width:640px;margin:20px auto;background:#fff;color:#14233a;border-radius:14px;padding:28px 30px;font-family:Arial,sans-serif;direction:rtl}.receipt h1{text-shadow:none}.receipt .amt{margin:16px 0;padding:14px 18px;background:#f6f1e3;border-radius:10px;font-size:22px;font-weight:800;display:flex;justify-content:space-between}@media print{header.top,.side,.print-hide{display:none!important}body{background:#fff}.receipt{margin:0;max-width:none}}`}</style>
      <strong style={{ fontSize: 20 }}>{s("company_name") || "נייחא"}</strong>
      <div>{s("company_id") && `ח.פ ${s("company_id")} · `}{s("company_address")} {s("company_phone")}</div>
      <h1>קבלת זיכוי מספר {cc.number}</h1>
      <p>מתייחסת לקבלה מספר {cc.payments?.receipt_no}{cc.reason ? ` · ${cc.reason}` : ""}</p>
      <p>תאריך {new Date(cc.created_at).toLocaleDateString("he-IL", { timeZone: "Asia/Jerusalem" })}</p>
      <p>לכבוד: {bb.customers?.full_name} · אירוח: {bb.apartments?.name} · {fmtDate(bb.check_in)} עד {fmtDate(bb.check_out)}</p>
      <div className="amt"><span>סכום הזיכוי</span><span>{cc.amount.toLocaleString()} ₪</span></div>
      <p style={{ textAlign: "center" }}><PrintButton /></p>
    </div>
  );
}
