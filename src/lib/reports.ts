import { addDays, nightsBetween } from "./pricing";

export interface RBooking { apartment_id: string; check_in: string; check_out: string; status: string; total_price: number }
export interface RApartment { id: string; name: string; owner_id: string; owner_name: string }

/** לילות של הזמנה שנופלים בטווח [from, to). */
export function nightsInRange(b: { check_in: string; check_out: string }, from: string, to: string) {
  const a = b.check_in > from ? b.check_in : from;
  const z = b.check_out < to ? b.check_out : to;
  return z > a ? nightsBetween(a, z) : 0;
}

export function summarize(apts: RApartment[], bookings: RBooking[], from: string, to: string) {
  const days = Math.max(1, nightsBetween(from, to));
  const closed = bookings.filter((b) => b.status === "confirmed");
  const rows = apts.map((a) => {
    const mine = closed.filter((b) => b.apartment_id === a.id);
    const nights = mine.reduce((s, b) => s + nightsInRange(b, from, to), 0);
    // הכנסה מחולקת לפי חלק הלילות שבטווח, כדי שהזמנה שחוצה חודש לא תיספר פעמיים
    const revenue = Math.round(mine.reduce((s, b) => {
      const total = nightsBetween(b.check_in, b.check_out);
      return s + (total ? (b.total_price * nightsInRange(b, from, to)) / total : 0);
    }, 0));
    return { id: a.id, name: a.name, owner: a.owner_name, ownerId: a.owner_id, nights, revenue, occupancy: Math.round((nights / days) * 100) };
  });
  const byOwner = new Map<string, { owner: string; nights: number; revenue: number }>();
  for (const r of rows) {
    const o = byOwner.get(r.ownerId) ?? { owner: r.owner, nights: 0, revenue: 0 };
    o.nights += r.nights; o.revenue += r.revenue;
    byOwner.set(r.ownerId, o);
  }
  return { rows, owners: [...byOwner.values()], totalRevenue: rows.reduce((s, r) => s + r.revenue, 0), totalNights: rows.reduce((s, r) => s + r.nights, 0), days };
}

export const monthRange = (month: string) => {
  const from = `${month}-01`;
  const [y, m] = month.split("-").map(Number);
  const to = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`;
  return { from, to };
};
export { addDays };
