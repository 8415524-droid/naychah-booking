import { addDays, nightsBetween } from "./pricing";

export interface AlertBooking {
  id: string; apartment: string; customer: string; status: string;
  check_in: string; check_out: string; deposit_required: number; paid: number;
  hold_expires_at: string | null;
}
export interface AlertApartment { id: string; name: string; hasPricing: boolean; hasOwnerPhone: boolean; calendarSynced: boolean }
export interface Alert { sev: "bad" | "warn"; text: string; href?: string }

/** התראות על מה שדורש טיפול עכשיו. today = YYYY-MM-DD בישראל, nowMs = זמן נוכחי. */
export function buildAlerts(bookings: AlertBooking[], apts: AlertApartment[], today: string, nowMs: number): Alert[] {
  const out: Alert[] = [];
  for (const b of bookings) {
    const href = `/bookings/${b.id}`;
    if (b.status === "hold" && b.hold_expires_at) {
      const left = Math.round((new Date(b.hold_expires_at).getTime() - nowMs) / 60000);
      if (left > 0) {
        out.push({ sev: left <= 10 ? "bad" : "warn", text: `${b.customer}: ${b.apartment} ממתינה למקדמה (נותרו ${left} דקות, ${Math.max(0, b.deposit_required - b.paid)} ₪)`, href });
      }
    }
    if (b.status === "confirmed") {
      if (b.check_in === today) out.push({ sev: "warn", text: `כניסה היום: ${b.customer} ל${b.apartment}`, href });
      else if (b.check_in === addDays(today, 1)) out.push({ sev: "warn", text: `כניסה מחר: ${b.customer} ל${b.apartment}`, href });
      if (b.check_out === today) out.push({ sev: "warn", text: `יציאה היום: ${b.customer} מ${b.apartment}`, href });
      if (b.paid < b.deposit_required) out.push({ sev: "bad", text: `הזמנה סגורה עם מקדמה חסרה: ${b.customer}, ${b.apartment}`, href });
    }
  }
  for (const a of apts) {
    const href = `/apartments/${a.id}`;
    if (!a.hasPricing) out.push({ sev: "warn", text: `לדירה ${a.name} אין מחירון, אי אפשר להצעה ללקוחות`, href });
    if (!a.hasOwnerPhone) out.push({ sev: "warn", text: `לבעל הדירה ${a.name} אין טלפון, אי אפשר לצנתק אותו`, href });
    if (!a.calendarSynced) out.push({ sev: "warn", text: `היומן של ${a.name} אינו מסונכרן עם הבעלים`, href });
  }
  return out.sort((x, y) => (x.sev === y.sev ? 0 : x.sev === "bad" ? -1 : 1));
}

export { nightsBetween };
