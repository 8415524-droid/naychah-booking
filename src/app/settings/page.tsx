import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth";
import Shell from "@/components/Shell";

const FIELDS: { key: string; label: string; hint: string }[] = [
  { key: "secretary_phone", label: "טלפון המזכירה (שלוחה 1)", hint: "אליו מועברות שיחות הזמנה כשאין תור" },
  { key: "service_phone", label: "טלפון שירות לקוחות (שלוחה 3)", hint: "אם ריק, עובר למזכירה" },
  { key: "queue_router_id", label: "מזהה תור המתנה בטכנוליין", hint: "אם מוגדר, שלוחה 1 מכניסה לתור במקום לחייג למזכירה" },
  { key: "music_url", label: "קישור לקובץ מוזיקת מירון (mp3)", hint: "מושמע בפתיחת השיחה" },
];

async function save(fd: FormData) {
  "use server";
  const { supabase } = await getSession(["admin"]);
  for (const f of FIELDS) {
    await supabase.from("settings").upsert({ key: f.key, value: String(fd.get(f.key) ?? "").trim() });
  }
  for (const k of ["deposit_percent", "hold_minutes"]) {
    const v = Number(fd.get(k));
    if (v > 0) await supabase.from("settings").upsert({ key: k, value: v });
  }
  revalidatePath("/settings");
}

export default async function Settings() {
  const { supabase, role, name } = await getSession(["admin"]);
  const { data } = await supabase.from("settings").select("key, value");
  const v = (k: string) => String((data ?? []).find((r) => r.key === k)?.value ?? "");
  return (
    <Shell role={role} name={name}>
      <h1>הגדרות</h1>
      <form className="card" action={save}>
        <h2>הזמנות</h2>
        <div className="grid2">
          <div><label>אחוז מקדמה</label><input type="number" name="deposit_percent" min={1} max={100} defaultValue={v("deposit_percent") || 12} /></div>
          <div><label>משך תפיסה זמנית (דקות)</label><input type="number" name="hold_minutes" min={1} defaultValue={v("hold_minutes") || 30} /></div>
        </div>
        <h2>מרכזייה</h2>
        {FIELDS.map((f) => (
          <div key={f.key}><label>{f.label}</label><input name={f.key} defaultValue={v(f.key)} /><span className="muted">{f.hint}</span></div>
        ))}
        <button className="primary">שמירה</button>
      </form>
    </Shell>
  );
}
