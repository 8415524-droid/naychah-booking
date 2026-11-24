import { fmtDate } from "./weekends";

export interface MsgBooking {
  customer: string; apartment: string; check_in: string; check_out: string; guests: number | null;
  total_price: number; deposit_required: number; paid: number; hold_minutes_left?: number | null;
}

/** מספר ישראלי לפורמט בינלאומי בלי פלוס, לקישור וואטסאפ. */
export function waNumber(phone: string): string {
  const d = phone.replace(/\D/g, "");
  if (d.startsWith("972")) return d;
  if (d.startsWith("0")) return "972" + d.slice(1);
  return d;
}
export const waLink = (phone: string, text: string) => `https://wa.me/${waNumber(phone)}?text=${encodeURIComponent(text)}`;

const dates = (b: MsgBooking) => `${fmtDate(b.check_in)} עד ${fmtDate(b.check_out)}`;
const nis = (n: number) => `${n.toLocaleString("he-IL")} ₪`;

/** הודעות מוכנות ללקוח. אחוז המקדמה מגיע מההגדרות (12%), לא קבוע בקוד. */
export function customerMessages(b: MsgBooking, depositPercent: number): { key: string; label: string; text: string }[] {
  const remainingDeposit = Math.max(0, b.deposit_required - b.paid);
  return [
    {
      key: "deposit", label: "בקשת מקדמה",
      text: `שלום ${b.customer},\nתודה שפנית אלינו. שמרנו עבורך את ${b.apartment} בתאריכים ${dates(b)}${b.hold_minutes_left ? ` למשך ${b.hold_minutes_left} דקות` : ""}.\nסכום ההזמנה: ${nis(b.total_price)}.\nכדי לסגור את ההזמנה נדרשת מקדמה של ${depositPercent}%: ${nis(remainingDeposit)}.\nאפשר לשלם באשראי או בהעברה, ונשלח קבלה.`,
    },
    {
      key: "confirmed", label: "אישור הזמנה",
      text: `שלום ${b.customer},\nהזמנתך אושרה.\nדירה: ${b.apartment}\nכניסה: ${fmtDate(b.check_in)}\nיציאה: ${fmtDate(b.check_out)}${b.guests ? `\nמספר אנשים: ${b.guests}` : ""}\nסכום ההזמנה: ${nis(b.total_price)}\nשולמה מקדמה: ${nis(b.paid)}\nיתרה לתשלום לבעל הדירה בכניסה: ${nis(Math.max(0, b.total_price - b.paid))}.\nנשמח לארח!`,
    },
    {
      key: "reminder", label: "תזכורת לפני הכניסה",
      text: `שלום ${b.customer},\nתזכורת: ההגעה ל${b.apartment} ב-${fmtDate(b.check_in)}.\nיתרה לתשלום לבעל הדירה: ${nis(Math.max(0, b.total_price - b.paid))}.\nנסיעה טובה ושבת שלום.`,
    },
    {
      key: "thanks", label: "תודה אחרי השהייה",
      text: `שלום ${b.customer},\nתודה שבחרתם בנו. מקווים שנהניתם ב${b.apartment}, ונשמח לארח אתכם שוב.`,
    },
  ];
}
