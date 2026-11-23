import { readFileSync } from "node:fs";
import { join } from "node:path";

// זמני: הגשת קובץ מוזיקת ההמתנה להעלאה לטכנוליין. להסיר אחרי ההעלאה.
export const dynamic = "force-dynamic";
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "*",
  "Cache-Control": "no-store",
};
export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}
export function GET(req: Request) {
  if (new URL(req.url).searchParams.get("ping")) {
    return Response.json({ ok: true }, { headers: CORS });
  }
  if (new URL(req.url).searchParams.get("frame")) {
    const html = `<!doctype html><script>fetch(location.pathname).then(r=>r.arrayBuffer()).then(b=>parent.postMessage({holdBuf:b},"*")).catch(e=>parent.postMessage({holdErr:String(e)},"*"))</script>`;
    return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
  }
  const buf = readFileSync(join(process.cwd(), "private", "hold-bar.mp3"));
  return new Response(buf, { headers: { ...CORS, "Content-Type": "audio/mpeg", "Content-Length": String(buf.length) } });
}
