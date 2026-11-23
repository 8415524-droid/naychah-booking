import { readFileSync } from "node:fs";
import { join } from "node:path";

// זמני: הגשת קובץ מוזיקת ההמתנה להעלאה לטכנוליין. להסיר אחרי ההעלאה.
export const dynamic = "force-dynamic";
const H = { "Access-Control-Allow-Origin": "*", "Content-Type": "audio/mpeg" };
export function GET() {
  const buf = readFileSync(join(process.cwd(), "private", "hold-bar.mp3"));
  return new Response(buf, { headers: H });
}
