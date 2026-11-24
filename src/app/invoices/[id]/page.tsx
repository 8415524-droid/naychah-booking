import { notFound } from "next/navigation";
import { getSession } from "@/lib/auth";
import PrintButton from "@/components/PrintButton";

export default async function InvoicePrint({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase } = await getSession(["admin"]);
  const [{ data: i }, { data: st }] = await Promise.all([
    supabase.from("commission_invoices").select("*, owners(name)").eq("id", id).single(),
    supabase.from("settings").select("key, value").in("key", ["company_name", "company_id", "company_address", "company_phone"]),
  ]);
  if (!i) notFound();
  const s = (k: string) => String((st ?? []).find((r) => r.key === k)?.value ?? "");
  const inv = i as any;
  return (
    <div className="inv">
      <style>{`.inv{max-width:700px;margin:20px auto;background:#fff;color:#14233a;border-radius:12px;padding:28px 32px;font-family:Arial,sans-serif;direction:rtl}.inv h1{text-shadow:none}.inv table{width:100%}.inv th,.inv td{border-bottom:1px solid #ddd;color:#14233a}@media print{header.top,.side,.print-hide{display:none!important}body{background:#fff}.inv{margin:0;max-width:none}}`}</style>
      <strong style={{ fontSize: 20 }}>{s("company_name") || "נייחא"}</strong>
      <div>{s("company_id") && `ח.פ ${s("company_id")} · `}{s("company_address")} {s("company_phone")}</div>
      <h1>חשבונית עמלה מספר {inv.number} (טיוטה)</h1>
      <p>לכבוד: {inv.owners?.name} · תקופה: {inv.month} · הופקה {new Date(inv.created_at).toLocaleDateString("he-IL")}</p>
      <table><thead><tr><th>תיאור</th><th>עמלה</th></tr></thead>
        <tbody>{(inv.lines as { desc: string; comm: number }[]).map((l, k) => <tr key={k}><td>{l.desc}</td><td>{l.comm.toLocaleString()} ₪</td></tr>)}</tbody></table>
      <p>סכום לפני מע״מ: {inv.net.toLocaleString()} ₪<br />מע״מ: {inv.vat.toLocaleString()} ₪<br /><strong>סך הכל: {inv.total.toLocaleString()} ₪</strong></p>
      <p style={{ textAlign: "center" }}><PrintButton /></p>
    </div>
  );
}
