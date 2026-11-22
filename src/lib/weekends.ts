import { HebrewCalendar } from "@hebcal/core";
import { addDays } from "./pricing";

export interface Weekend { saturday: string; parsha: string }

const stripNikud = (s: string) => s.replace(/[֑-ׇ]/g, "");

/** שבתות קרובות עם שם הפרשה (לפי לוח ארץ ישראל). */
export function upcomingWeekends(fromDate: string, count = 16): Weekend[] {
  const end = addDays(fromDate, count * 7 + 7);
  const events = HebrewCalendar.calendar({
    start: new Date(fromDate + "T00:00:00Z"), end: new Date(end + "T00:00:00Z"),
    sedrot: true, il: true, noHolidays: true,
  });
  return events
    .map((e) => ({ saturday: e.getDate().greg().toISOString().slice(0, 10), parsha: stripNikud(e.render("he")) }))
    .filter((w) => w.saturday >= fromDate)
    .slice(0, count);
}

export const fmtDate = (d: string) => d.split("-").reverse().join("/");
