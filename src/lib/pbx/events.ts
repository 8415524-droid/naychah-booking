/** אירוע completed מהמרכזייה: סוף שיחה וקישור להקלטה. לוגיקה טהורה, נבדקת ב-events.test.ts. */
export interface CompletedCall { phone: string | null; direction: "in" | "out"; recordingUrl: string | null; durationS: number | null; status: string | null }

const asUrl = (v: unknown) => (typeof v === "string" && /^https:\/\//.test(v) ? v : null);

export function parseCompleted(body: unknown): CompletedCall | null {
  if (!body || typeof body !== "object") return null;
  const b = body as Record<string, any>;
  if (b.event !== "completed") return null;
  const legs: any[] = Array.isArray(b.legs) ? b.legs : [];
  const recordingUrl = asUrl(b.recordingUrl) ?? asUrl(legs.find((l) => asUrl(l?.recordingUrl))?.recordingUrl);
  const dir = b.direction === "out" ? "out" : "in";
  const phoneRaw = String(dir === "in" ? b.from ?? b.phone ?? "" : b.to ?? "").replace(/\D/g, "");
  const secs = Number(b.answerLength ?? b.callLength);
  return {
    phone: phoneRaw ? (phoneRaw.startsWith("972") ? "0" + phoneRaw.slice(3) : phoneRaw) : null,
    direction: dir,
    recordingUrl,
    durationS: Number.isFinite(secs) && secs > 0 ? Math.round(secs) : null,
    status: typeof b.status === "string" ? b.status : null,
  };
}
