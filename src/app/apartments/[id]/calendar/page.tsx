import Link from "next/link";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth";
import Shell from "@/components/Shell";
import { addDays, dowOf, nowInJerusalem } from "@/lib/pricing";
import { isSafeIcalUrl, parseIcal } from "@/lib/ical";
import { DOW_HE } from "@/lib/labels";
import { closeNight, openNight } from "@/lib/blocks";

const MONTHS = ["ינואר", "פברואר", "מרץ", "אפריל", "מאי", "יוני", "יולי", "אוגוסט", "ספטמבר", "אוקטובר", "נובמבר", "דצמבר"];

async function toggleDay(fd: FormData) {
  "use server";
  const { supabase, role } = await getSession(["admin", "owner"]);
  const apt = String(fd.get("apartment_id"));
  const day = String(fd.get("day"));
  const m = String(fd.get("m"));
  const source = role === "admin" ? "admin" : "owner_web";
  const opened = await openNight(supabase, apt, day);
  if (!opened) await closeNight(supabase, apt, day, source);
  revalidatePath(`/apartments/${apt}/calendar`);
  redirect(`/apartments/${apt}/calendar?m=${m}`);
}

async function importIcal(fd: FormData) {
  "use server";
  const { supabase } = await getSession(["admin", "owner"]);
  const apt = String(fd.get("apartment_id"));
  const m = String(fd.get("m"));
  const back = (msg: string) => redirect(`/apartments/${apt}/calendar?m=${m}&msg=${encodeURIComponent(msg)}`);
  const { data: a } = await supabase.from("apartments").select("ical_import_url").eq("id", apt).single();
  const url = a?.ical_import_url;
  if (!url) return back("לא הוגדרה כתובת יומן לייבוא (בעריכת הדירה)");
  if (!isSafeIcalUrl(url)) return back("כתובת היומן אינה תקינה (נדרש https לכתובת ציבורית)");
  let text: string;
  try {
    const res = await fetch(url, { redirect: "manual", signal: AbortSignal.timeout(10000) });
    if (!res.ok) return back(`היומן החיצוני החזיר שגיאה ${res.status}`);
    text = (await res.text()).slice(0, 2_000_000);
  } catch {
    return back("לא הצלחתי להגיע ליומן החיצוני");
  }
  const today = nowInJerusalem().slice(0, 10);
  const ranges = parseIcal(text).filter((r) => r.to > today);
  await supabase.from("blocks").delete().eq("apartment_id", apt).eq("source", "ical");
  let added = 0, skipped = 0;
  for (const r of ranges) {
    const { error } = await supabase.from("blocks").insert({ apartment_id: apt, date_from: r.from < today ? today : r.from, date_to: r.to, source: "ical" });
    if (error) skipped++; else added++;
  }
  revalidatePath(`/apartments/${apt}/calendar`);
  back(`יובאו ${added} חסימות${skipped ? `, ${skipped} דולגו כי כבר תפוסות` : ""}`);
}

export default async function Calendar({ params, searchParams }: {
  params: Promise<{ id: string }>; searchParams: Promise<{ m?: string; msg?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const { supabase, role, name } = await getSession(["admin", "agent", "owner"]);
  const { data: apt } = await supabase.from("apartments").select("id, name, ical_token, ical_import_url").eq("id", id).single();
  if (!apt) notFound();

  const today = nowInJerusalem().slice(0, 10);
  const month = /^\d{4}-\d{2}$/.test(sp.m ?? "") ? sp.m! : today.slice(0, 7);
  const first = `${month}-01`;
  const [y, mo] = month.split("-").map(Number);
  const next = mo === 12 ? `${y + 1}-01` : `${y}-${String(mo + 1).padStart(2, "0")}`;
  const prev = mo === 1 ? `${y - 1}-12` : `${y}-${String(mo - 1).padStart(2, "0")}`;
  const monthEnd = `${next}-01`;
  const days: string[] = [];
  for (let d = first; d < monthEnd; d = addDays(d, 1)) days.push(d);

  const [{ data: blocks }, { data: bookings }] = await Promise.all([
    supabase.from("blocks").select("date_from, date_to, source").eq("apartment_id", id).lt("date_from", monthEnd).gt("date_to", first),
    supabase.from("bookings").select("check_in, check_out, status, hold_expires_at").eq("apartment_id", id).in("status", ["hold", "confirmed"]).lt("check_in", monthEnd).gt("check_out", first),
  ]);
  const nowIso = new Date().toISOString();
  const state = (d: string) => {
    const bk = bookings?.find((b) => b.check_in <= d && b.check_out > d && (b.status === "confirmed" || (b.hold_expires_at && b.hold_expires_at > nowIso)));
    if (bk) return bk.status === "confirmed" ? "booked" : "hold";
    const bl = blocks?.find((b) => b.date_from <= d && b.date_to > d);
    if (bl) return bl.source === "ical" ? "ical" : "blocked";
    return "free";
  };
  const LABEL: Record<string, string> = { booked: "הזמנה", hold: "תפוסה זמנית", blocked: "חסום", ical: "חסום (יומן חיצוני)", free: "פנוי" };
  const canEdit = role === "admin" || role === "owner";
  const host = (await headers()).get("host");
  const feedUrl = `https://${host}/api/ical/${apt.ical_token}`;
  const pad = dowOf(first);

  return (
    <Shell role={role} name={name}>
      <div className="row"><h1>יומן · {apt.name}</h1><Link href={`/apartments/${id}`}>חזרה לדירה</Link></div>
      <div className="card">
        <div className="row">
          <Link href={`?m=${prev}`}>← חודש קודם</Link>
          <strong>{MONTHS[mo - 1]} {y}</strong>
          <Link href={`?m=${next}`}>חודש הבא →</Link>
        </div>
        <div className="cal">
          {DOW_HE.map((d) => <div key={d} className="calh">{d.slice(0, 3)}</div>)}
          {Array.from({ length: pad }).map((_, i) => <div key={"p" + i} />)}
          {days.map((d) => {
            const s = state(d);
            const cell = <><span>{Number(d.slice(8))}</span><small>{LABEL[s]}</small></>;
            const editable = canEdit && (s === "free" || s === "blocked" || s === "ical") && d >= today;
            return editable ? (
              <form key={d} action={toggleDay}>
                <input type="hidden" name="apartment_id" value={id} />
                <input type="hidden" name="day" value={d} />
                <input type="hidden" name="m" value={month} />
                <button className={`cell ${s}`} title="לחיצה פותחת או סוגרת את הלילה">{cell}</button>
              </form>
            ) : <div key={d} className={`cell ${s}`}>{cell}</div>;
          })}
        </div>
        <p className="muted">כל תא הוא לילה (כניסה באותו יום). {canEdit ? "לחיצה על תא פנוי סוגרת אותו, ולחיצה על תא חסום פותחת." : "תצוגה בלבד."}</p>
        {sp.msg && <p className="ok">{sp.msg}</p>}
      </div>

      <div className="card">
        <h2>סנכרון יומן</h2>
        <p><strong>ייצוא:</strong> הדבק את הכתובת הזו ביומן שלך (Google Calendar → הוספת יומן → מכתובת URL). היא סודית, אל תשתף אותה.</p>
        <input readOnly value={feedUrl} onFocus={(e) => e.currentTarget.select()} />
        <p><strong>ייבוא:</strong> {apt.ical_import_url ? "מוגדרת כתובת יומן חיצוני." : "לא הוגדרה כתובת (מגדירים בעריכת הדירה)."}</p>
        {canEdit && (
          <form action={importIcal}>
            <input type="hidden" name="apartment_id" value={id} />
            <input type="hidden" name="m" value={month} />
            <button className="btn">סנכרן עכשיו מהיומן החיצוני</button>
          </form>
        )}
      </div>
    </Shell>
  );
}
