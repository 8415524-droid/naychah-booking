import { addDays, dowOf } from "../pricing";
import { upcomingWeekends } from "../weekends";

const MONTHS = ["", "בינואר", "בפברואר", "במרץ", "באפריל", "במאי", "ביוני", "ביולי", "באוגוסט", "בספטמבר", "באוקטובר", "בנובמבר", "בדצמבר"];
export const dayMonth = (d: string) => `${Number(d.slice(8))} ${MONTHS[Number(d.slice(5, 7))]}`;

/** תיאור שהייה להקראה: סופ"ש לפי פרשה, או תאריכים. */
export function describeStay(checkIn: string, checkOut: string): string {
  const dow = dowOf(checkIn);
  const nights = Math.round((Date.parse(checkOut) - Date.parse(checkIn)) / 86400000);
  if (dow === 4 || dow === 5) {
    const sat = addDays(checkIn, 6 - dow);
    if (checkOut === sat || (dow === 4 && nights === 2)) {
      const w = upcomingWeekends(sat, 1)[0];
      if (w && w.saturday === sat) {
        return dow === 4 ? `סופ"ש פרשת ${w.parsha.replace(/^פרשת /, "")}, מחמישי עד שבת` : `ליל שבת פרשת ${w.parsha.replace(/^פרשת /, "")}`;
      }
    }
  }
  return nights === 1 ? `לילה של ${dayMonth(checkIn)}` : `מ${dayMonth(checkIn)} עד ${dayMonth(checkOut)}`;
}
