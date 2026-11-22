import { adminClient } from "../supabase/admin";
import type { PbxParams, PbxResponse } from "./types";
import { hangup, say } from "./types";

/** מעטפת משותפת לנקודות הקצה של המרכזייה: בדיקת סוד, JSON תמיד תקין, רישום שיחה. */
export async function pbxHandler(
  req: Request, secretParam: string, expected: string | undefined,
  kind: "owner" | "customer", run: (q: PbxParams) => Promise<PbxResponse>,
) {
  const json = (o: unknown) => new Response(JSON.stringify(o), { headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } });
  if (!expected || secretParam !== expected) return new Response("Not found", { status: 404 });
  const q: PbxParams = Object.fromEntries(new URL(req.url).searchParams.entries());
  try {
    const out = await run(q);
    void logCall(kind, q).catch(() => {});
    return json(out);
  } catch {
    // תשובה לא תקינה מחזירה את המתקשר לתפריט הקודם, ולכן תמיד מחזירים JSON תקין
    return json([say("אירעה תקלה. אנא נסו שוב מאוחר יותר."), hangup()]);
  }
}

async function logCall(kind: string, q: PbxParams) {
  if (q.PBXcallStatus !== "CALL" && q.PBXcallStatus !== undefined) return; // רושמים פעם אחת, בתחילת שיחה
  if (q.main !== undefined || q.menu !== undefined || q.pin !== undefined) return;
  await adminClient().from("call_log").insert({ direction: "in", kind, phone: q.PBXphone ?? null });
}
