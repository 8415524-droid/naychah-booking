// חישובי כספים של החברה. הכנסת החברה = המקדמה (חלקנו) מהזמנות סגורות, לפי חודש הכניסה.

export interface FinSettings { vatPct: number; oncostPct: number }
export const DEFAULT_FIN: FinSettings = { vatPct: 18, oncostPct: 22 };

export function vatSplit(amount: number, vatPct: number, includesVat: boolean) {
  if (!includesVat) return { net: amount, vat: 0 };
  const net = amount / (1 + vatPct / 100);
  return { net, vat: amount - net };
}

export function employeeCost(e: { pay_kind: string; rate: number }, hours: number, bonus: number, oncostPct: number) {
  const base = e.pay_kind === "hourly" ? hours * e.rate : e.rate;
  const gross = base + bonus;
  return { gross, cost: gross * (1 + oncostPct / 100) };
}

export interface PBooking { apartment_id: string; apartment: string; owner_id: string; owner: string; check_in: string; status: string; total_price: number; deposit_required: number }
export interface PExpense { spent_on: string; category: string; amount: number; includes_vat: boolean }
export interface PCost { month: string; category: string; amount: number; apartment_id?: string | null; charge_owner?: boolean }

export function plSummary(month: string, bookings: PBooking[], expenses: PExpense[], costs: PCost[], payrollCost: number, fin: FinSettings) {
  const inM = (d: string) => month === "all" || d.slice(0, 7) === month;
  const bs = bookings.filter((b) => b.status === "confirmed" && inM(b.check_in));
  const gross = bs.reduce((s, b) => s + b.total_price, 0);
  const rev = bs.reduce((s, b) => s + b.deposit_required, 0);
  const byCat: Record<string, number> = {};
  let vatIn = 0, expNet = 0;
  for (const e of expenses.filter((x) => inM(x.spent_on))) {
    const { net, vat } = vatSplit(e.amount, fin.vatPct, e.includes_vat);
    byCat[e.category] = (byCat[e.category] ?? 0) + net; expNet += net; vatIn += vat;
  }
  const perHouse = new Map<string, { name: string; n: number; gross: number; rev: number; cost: number }>();
  for (const b of bs) {
    const r = perHouse.get(b.apartment_id) ?? { name: b.apartment, n: 0, gross: 0, rev: 0, cost: 0 };
    r.n++; r.gross += b.total_price; r.rev += b.deposit_required; perHouse.set(b.apartment_id, r);
  }
  let direct = 0;
  for (const c of costs.filter((x) => (month === "all" || x.month === month) && !x.charge_owner)) {
    byCat[c.category] = (byCat[c.category] ?? 0) + c.amount; direct += c.amount;
    if (c.apartment_id && perHouse.has(c.apartment_id)) perHouse.get(c.apartment_id)!.cost += c.amount;
  }
  const vatOut = rev * (fin.vatPct / 100);
  const profit = rev - expNet - direct - payrollCost;
  return { bookings: bs.length, gross, rev, expNet: expNet + direct, payrollCost, profit, vatOut, vatIn, byCat, perHouse: [...perHouse.values()], margin: rev > 0 ? Math.round((profit / rev) * 100) : null };
}

/** התחשבנות עם בעלי דירות: מה מגיע לכל בעל דירה אחרי ניכוי חשבונות ותחזוקה שהחברה שילמה בשמו. */
export function settlement(bookings: PBooking[], deductions: { owner_id: string; amount: number }[], month: string) {
  const m = new Map<string, { owner: string; n: number; gross: number; company: number; due: number; ded: number }>();
  for (const b of bookings.filter((x) => x.status === "confirmed" && (month === "all" || x.check_in.slice(0, 7) === month))) {
    const r = m.get(b.owner_id) ?? { owner: b.owner, n: 0, gross: 0, company: 0, due: 0, ded: 0 };
    r.n++; r.gross += b.total_price; r.company += b.deposit_required; r.due += b.total_price - b.deposit_required;
    m.set(b.owner_id, r);
  }
  for (const d of deductions) { const r = m.get(d.owner_id); if (r) r.ded += d.amount; }
  return [...m.values()].map((r) => ({ ...r, net: r.due - r.ded }));
}

/** שורות לחשבונית עמלה: הזמנות סגורות של בעל דירה בחודש. */
export function invoiceLines(bookings: PBooking[], ownerId: string, month: string, vatPct: number) {
  const lines = bookings.filter((b) => b.owner_id === ownerId && b.status === "confirmed" && b.check_in.slice(0, 7) === month)
    .map((b) => ({ desc: `${b.apartment} · ${b.check_in}`, comm: b.deposit_required }));
  const net = lines.reduce((s, l) => s + l.comm, 0);
  const vat = Math.round(net * vatPct / 100);
  return { lines, net, vat, total: net + vat };
}

export const EXPENSE_CATEGORIES = ["שיווק ופרסום", "תוכנה ומערכות", "טלפוניה", "משרד ושכירות", "נסיעות", "ייעוץ מקצועי", "עמלות סליקה", "ביטוח", "שונות"];
export const BILL_TYPES = ["חשמל", "מים", "ארנונה", "גז", "ועד בית", "אינטרנט", "אחר"];
export const AD_CHANNELS = ["גוגל", "פייסבוק / אינסטגרם", "וואטסאפ", "עיתון / מודעה", "המלצה", "לקוח חוזר", "אחר"];

export const monthsBack = (fromMonth: string, n: number) => {
  const [y, m] = fromMonth.split("-").map(Number);
  return Array.from({ length: n }, (_, i) => { const d = new Date(Date.UTC(y, m - 1 - i, 1)); return d.toISOString().slice(0, 7); });
};
