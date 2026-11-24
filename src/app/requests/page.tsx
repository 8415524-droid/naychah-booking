import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth";
import Shell from "@/components/Shell";
import { waLink } from "@/lib/messages";
import { fmtDate } from "@/lib/weekends";

async function setStatus(fd: FormData) {
  "use server";
  const { supabase } = await getSession(["admin", "agent"]);
  const status = String(fd.get("status"));
  if (!["handled", "dismissed", "new"].includes(status)) return;
  await supabase.from("booking_requests").update({ status }).eq("id", String(fd.get("id")));
  revalidatePath("/requests");
}

export default async function Requests({ searchParams }: { searchParams: Promise<{ all?: string }> }) {
  const sp = await searchParams;
  const { supabase, role, name } = await getSession(["admin", "agent"]);
  const { data } = await supabase.from("booking_requests").select("*").order("created_at", { ascending: false }).limit(200);
  const list = (data ?? []).filter((r) => sp.all === "1" || r.status === "new");
  const host = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  return (
    <Shell role={role} name={name}>
      <h1>בקשות מהאתר</h1>
      <div className="card">
        <p className="muted">לקוחות ממלאים טופס ציבורי בכתובת <strong dir="ltr">{host}/book-request</strong>, והבקשה מופיעה כאן. טלפנית חוזרת ללקוח ומחפשת לו דירה.</p>
        <a className="btn" href={sp.all === "1" ? "/requests" : "/requests?all=1"}>{sp.all === "1" ? "רק חדשות" : "הצג הכול"}</a>
      </div>
      {list.length === 0 && <div className="card muted">אין בקשות חדשות.</div>}
      {list.map((r) => (
        <div key={r.id} className="card">
          <div className="row"><strong>{r.full_name}</strong><span className="muted">{new Date(r.created_at).toLocaleString("he-IL", { timeZone: "Asia/Jerusalem" })}</span></div>
          <p dir="ltr" style={{ textAlign: "start" }}>{r.phone}</p>
          <p>{r.check_in ? `${fmtDate(r.check_in)} עד ${r.check_out ? fmtDate(r.check_out) : "?"}` : "ללא תאריכים"}{r.guests ? ` · ${r.guests} אנשים` : ""}</p>
          {r.notes && <p className="muted">{r.notes}</p>}
          <div className="row">
            <span>
              <a className="btn" href={`/search${r.check_in && r.check_out ? `?stay=custom&from=${r.check_in}&to=${r.check_out}${r.guests ? `&guests=${r.guests}` : ""}` : ""}`}>חיפוש דירה</a>{" "}
              <a className="btn" href={`tel:${r.phone}`}>התקשרות</a>{" "}
              <a className="btn" href={waLink(r.phone, `שלום ${r.full_name}, קיבלנו את בקשתך להזמנה. נשמח לעזור, מתי נוח לדבר?`)} target="_blank" rel="noopener noreferrer">וואטסאפ</a>
            </span>
            <form action={setStatus}><input type="hidden" name="id" value={r.id} />
              {r.status === "new" ? <><button className="btn" name="status" value="handled">טופל</button> <button className="danger" name="status" value="dismissed">התעלם</button></> : <button className="btn" name="status" value="new">החזר לחדשות</button>}
            </form>
          </div>
        </div>
      ))}
    </Shell>
  );
}
