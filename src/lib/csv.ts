/** CSV עם BOM כדי שאקסל יציג עברית נכון. */
export function toCsv(rows: Record<string, unknown>[], columns?: string[]): string {
  const cols = columns ?? (rows.length ? Object.keys(rows[0]) : []);
  const q = (v: unknown) => {
    let s = v == null ? "" : typeof v === "object" ? JSON.stringify(v) : String(v);
    // מניעת הזרקת נוסחאות באקסל
    if (/^[=+\-@]/.test(s) && typeof v === "string") s = "'" + s;
    return `"${s.replace(/"/g, '""')}"`;
  };
  return "﻿" + [cols.map(q).join(","), ...rows.map((r) => cols.map((c) => q(r[c])).join(","))].join("\r\n");
}
