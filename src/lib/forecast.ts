import { addDays } from "./pricing";
import { nightsInRange } from "./reports";

export interface FBooking { apartment_id: string; check_in: string; check_out: string; status: string; total_price: number; deposit_required: number }
export interface FBlock { apartment_id: string; date_from: string; date_to: string }
export interface WeekendRow {
  saturday: string; parsha: string; total: number; booked: number; held: number; blocked: number; free: number;
  occupancyPct: number; revenue: number; deposits: number; freeNames: string[];
}

/** סוף שבוע = לילות שישי ושבת: [שישי, ראשון). */
export function forecastWeekend(sat: string, parsha: string, apts: { id: string; name: string }[], bookings: FBooking[], blocks: FBlock[]): WeekendRow {
  const fri = addDays(sat, -1), sun = addDays(sat, 1);
  let booked = 0, held = 0, blocked = 0, revenue = 0, deposits = 0;
  const freeNames: string[] = [];
  for (const a of apts) {
    const mine = bookings.filter((b) => b.apartment_id === a.id && (b.status === "confirmed" || b.status === "hold") && b.check_in < sun && b.check_out > fri);
    if (mine.some((b) => b.status === "confirmed")) booked++;
    else if (mine.length) held++;
    else if (blocks.some((k) => k.apartment_id === a.id && k.date_from < sun && k.date_to > fri)) blocked++;
    else freeNames.push(a.name);
    for (const b of mine.filter((x) => x.status === "confirmed")) {
      const total = Math.max(1, nightsInRange({ check_in: b.check_in, check_out: b.check_out }, "0000-01-01", "9999-12-31"));
      const share = nightsInRange(b, fri, sun) / total;
      revenue += Math.round(b.total_price * share);
      deposits += Math.round(b.deposit_required * share);
    }
  }
  const total = apts.length;
  return { saturday: sat, parsha, total, booked, held, blocked, free: freeNames.length, occupancyPct: total ? Math.round(((booked + held) / total) * 100) : 0, revenue, deposits, freeNames };
}
