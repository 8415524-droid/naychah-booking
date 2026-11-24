import { createClient } from "@supabase/supabase-js";

async function submit(fd: FormData) {
  "use server";
  if (String(fd.get("website") || "")) return; // שדה פח נגד בוטים
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!);
  const { error } = await supabase.rpc("submit_booking_request", {
    p_name: String(fd.get("full_name") || ""), p_phone: String(fd.get("phone") || ""),
    p_guests: Number(fd.get("guests")) || null, p_in: String(fd.get("check_in") || "") || null, p_out: String(fd.get("check_out") || "") || null,
    p_notes: String(fd.get("notes") || ""),
  });
  const { redirect } = await import("next/navigation");
  redirect(error ? "/book-request?err=1" : "/book-request?ok=1");
}

// טופס ציבורי לבקשת הזמנה. פתוח בלי התחברות.
export default async function BookRequest({ searchParams }: { searchParams: Promise<{ ok?: string; err?: string }> }) {
  const sp = await searchParams;
  return (
    <main style={{ maxWidth: 520 }}>
      <h1>בקשה להזמנת דירה במירון</h1>
      {sp.ok ? <div className="card"><h2>תודה!</h2><p>קיבלנו את הבקשה ונחזור אליכם בהקדם.</p></div> : (
        <form className="card" action={submit}>
          {sp.err && <p className="err">לא הצלחנו לשלוח, בדקו שם וטלפון ונסו שוב.</p>}
          <label>שם מלא</label><input name="full_name" required minLength={2} />
          <label>טלפון</label><input name="phone" inputMode="tel" required />
          <div className="grid2">
            <div><label>כניסה</label><input type="date" name="check_in" /></div>
            <div><label>יציאה</label><input type="date" name="check_out" /></div>
          </div>
          <label>מספר אנשים</label><input type="number" name="guests" min={1} />
          <label>הערות</label><textarea name="notes" rows={3} maxLength={500} />
          <input name="website" tabIndex={-1} autoComplete="off" style={{ position: "absolute", left: "-9999px" }} aria-hidden />
          <button className="primary">שליחה</button>
        </form>
      )}
    </main>
  );
}
