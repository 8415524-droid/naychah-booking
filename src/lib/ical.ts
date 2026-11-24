import { addDays } from "./pricing";

export interface IcalRange { from: string; to: string } // to אקסקלוסיבי

/** פענוח VEVENT פשוט: תאריכי כניסה ויציאה בלבד. מתעלם מאירועים מבוטלים. */
export function parseIcal(text: string): IcalRange[] {
  const lines = text.replace(/\r\n/g, "\n").replace(/\n[ \t]/g, "").split("\n");
  const out: IcalRange[] = [];
  let ev: { start?: string; end?: string; cancelled?: boolean } | null = null;
  const dateOf = (v: string) => {
    const m = v.match(/(\d{4})(\d{2})(\d{2})/);
    return m ? `${m[1]}-${m[2]}-${m[3]}` : undefined;
  };
  for (const line of lines) {
    if (line.startsWith("BEGIN:VEVENT")) ev = {};
    else if (line.startsWith("END:VEVENT")) {
      if (ev && !ev.cancelled && ev.start) {
        let to = ev.end ?? addDays(ev.start, 1);
        if (to <= ev.start) to = addDays(ev.start, 1);
        out.push({ from: ev.start, to });
      }
      ev = null;
    } else if (ev) {
      const idx = line.indexOf(":");
      if (idx < 0) continue;
      const key = line.slice(0, idx).split(";")[0].toUpperCase();
      const val = line.slice(idx + 1);
      if (key === "DTSTART") ev.start = dateOf(val);
      else if (key === "DTEND") ev.end = dateOf(val);
      else if (key === "STATUS" && val.trim().toUpperCase() === "CANCELLED") ev.cancelled = true;
    }
  }
  return out;
}

/** webcal:// (אפל/אאוטלוק) הוא אותה כתובת ב-https. */
export function normalizeIcalUrl(raw: string): string {
  return raw.trim().replace(/^webcals?:\/\//i, "https://");
}

/** מגן מפני גישה לכתובות פנימיות (SSRF): רק https לשם מארח ציבורי. */
export function isSafeIcalUrl(raw: string): boolean {
  let u: URL;
  try { u = new URL(raw); } catch { return false; }
  if (u.protocol !== "https:" || u.username || u.password) return false;
  if (u.port && u.port !== "443") return false;
  const h = u.hostname.toLowerCase();
  if (h === "localhost" || h.endsWith(".localhost") || h.endsWith(".internal") || h.endsWith(".local")) return false;
  if (/^[\d.]+$/.test(h) || h.includes(":") || h.startsWith("[")) return false; // כתובות IP
  return h.includes(".");
}

const esc = (s: string) => s.replace(/[\;,]/g, "\\$&");
const compact = (d: string) => d.replace(/-/g, "");

export function buildIcal(name: string, ranges: { from: string; to: string; kind: string }[]) {
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//naychah//booking//HE", "CALSCALE:GREGORIAN", `X-WR-CALNAME:${esc(name)}`];
  ranges.forEach((r, i) => {
    lines.push(
      "BEGIN:VEVENT",
      `UID:${compact(r.from)}-${compact(r.to)}-${i}@naychah`,
      "DTSTAMP:20260101T000000Z",
      `DTSTART;VALUE=DATE:${compact(r.from)}`,
      `DTEND;VALUE=DATE:${compact(r.to)}`,
      `SUMMARY:${r.kind === "booking" ? "תפוס" : "חסום"}`,
      "END:VEVENT",
    );
  });
  lines.push("END:VCALENDAR");
  return lines.join("\r\n") + "\r\n";
}
