import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth";
import Collapsible from "@/components/Collapsible";
import Shell from "@/components/Shell";
import { AD_CHANNELS } from "@/lib/finance";
import { fmtDate } from "@/lib/weekends";

async function add(fd: FormData) {
  "use server";
  const { supabase } = await getSession(["admin"]);
  const cost = Math.round(Number(fd.get("cost")));
  if (!(cost >= 0)) return;
  await supabase.from("ad_spend").insert({
    channel: String(fd.get("channel")), label: String(fd.get("label") || "") || null, apartment_id: String(fd.get("apartment_id") || "") || null,
    cost, starts_on: String(fd.get("starts_on")), ends_on: String(fd.get("ends_on") || "") || null,
  });
  revalidatePath("/ads");
}
async function remove(fd: FormData) {
  "use server";
  const { supabase } = await getSession(["admin"]);
  await supabase.from("ad_spend").delete().eq("id", String(fd.get("id")));
  revalidatePath("/ads");
}

export default async function Ads() {
  const { supabase, role, name } = await getSession(["admin"]);
  const [{ data: apts }, { data: ads }, { data: bks }] = await Promise.all([
    supabase.from("apartments").select("id, name").eq("active", true).order("name"),
    supabase.from("ad_spend").select("*, apartments(name)").order("starts_on", { ascending: false }),
    supabase.from("bookings").select("marketing_channel, deposit_required, status").eq("status", "confirmed").not("marketing_channel", "is", null),
  ]);
  const roi = AD_CHANNELS.map((ch) => {
    const spend = (ads ?? []).filter((a) => a.channel === ch).reduce((s, a) => s + a.cost, 0);
    const mine = (bks ?? []).filter((b) => b.marketing_channel === ch);
    const rev = mine.reduce((s, b) => s + b.deposit_required, 0);
    return { ch, spend, n: mine.length, rev };
  }).filter((r) => r.spend > 0 || r.n > 0);
  const today = new Date().toISOString().slice(0, 10);
  return (
    <Shell role={role} name={name}>
      <h1>פרסום</h1>
      <Collapsible title="הוספת הוצאת פרסום" summary="ערוץ, עלות, תאריכים">
        <p className="muted">בכל הזמנה מסמנים מאיפה הלקוח הגיע (בכרטיס ההזמנה), וכך רואים כמה עולה כל הזמנה ואיזה ערוץ משתלם.</p>
        <form action={add}>
          <div className="grid2">
            <div><label>ערוץ</label><select name="channel">{AD_CHANNELS.map((c) => <option key={c}>{c}</option>)}</select></div>
            <div><label>תיאור (שם מודעה / עיתון)</label><input name="label" /></div>
            <div><label>דירה שמפרסמים (לא חובה)</label><select name="apartment_id"><option value="">כל הדירות</option>{(apts ?? []).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></div>
            <div><label>עלות (₪)</label><input type="number" name="cost" min={0} required /></div>
            <div><label>התחלה</label><input type="date" name="starts_on" defaultValue={today} required /></div>
            <div><label>סיום</label><input type="date" name="ends_on" /></div>
          </div>
          <button className="primary">הוספה</button>
        </form>
      </Collapsible>
      <div className="card">
        <h2>החזר השקעה לפי ערוץ</h2>
        {roi.length === 0 ? <p className="muted">אחרי שיירשמו פרסומים והזמנות עם ערוץ, יוצג כאן החזר ההשקעה.</p> : (
          <table>
            <thead><tr><th>ערוץ</th><th>הוצאה</th><th>הזמנות</th><th>מקדמות</th><th>עלות להזמנה</th><th>רווח מהערוץ</th></tr></thead>
            <tbody>{roi.map((r) => <tr key={r.ch}><td>{r.ch}</td><td>{r.spend.toLocaleString()} ₪</td><td>{r.n}</td><td>{r.rev.toLocaleString()} ₪</td><td>{r.n ? Math.round(r.spend / r.n).toLocaleString() + " ₪" : "—"}</td><td><strong>{(r.rev - r.spend).toLocaleString()} ₪</strong></td></tr>)}</tbody>
          </table>
        )}
      </div>
      <div className="card">
        <h2>הוצאות פרסום</h2>
        {(ads ?? []).map((a: any) => (
          <div key={a.id} className="row" style={{ borderTop: "1px solid var(--line)", padding: "8px 0" }}>
            <span><strong>{a.channel}</strong>{a.label ? ` · ${a.label}` : ""}<br /><span className="muted">{fmtDate(a.starts_on)}{a.ends_on ? ` עד ${fmtDate(a.ends_on)}` : ""} · {a.apartments?.name ?? "כל הדירות"} · {a.cost.toLocaleString()} ₪</span></span>
            <form action={remove}><input type="hidden" name="id" value={a.id} /><button className="danger">מחיקה</button></form>
          </div>
        ))}
        {!ads?.length && <p className="muted">עדיין לא נרשם פרסום.</p>}
      </div>
    </Shell>
  );
}
