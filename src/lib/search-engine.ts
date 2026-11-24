// מנוע חיפוש דירות חכם: טהור, בלי תלות במסד.
// במקום סינון קשיח, כל דירה מקבלת תגיות ✓ (עומדת) ו-⚠ (פער) וציון קרבה (נמוך = קרוב יותר).
// הפערים נשקלים כמו בחיפוש של מירון הישן: מיטות/חדרים חסרים, מחיר, מאפיינים חסרים ותפוסה חלקית.

export const AMENITIES: { key: string; label: string; legacy?: string }[] = [
  { key: "balcony", label: "מרפסת", legacy: "מרפסת" },
  { key: "sukkah_balcony", label: "מרפסת סוכה" },
  { key: "ac", label: "מזגן", legacy: "מזגן" },
  { key: "heating", label: "חימום" },
  { key: "equipped_kitchen", label: "מטבח מאובזר" },
  { key: "hotplate", label: "פלטה לשבת" },
  { key: "big_fridge", label: "מקרר גדול" },
  { key: "washer", label: "מכונת כביסה" },
  { key: "linens", label: "מצעים ומגבות" },
  { key: "internet", label: "אינטרנט" },
  { key: "elevator", label: "מעלית", legacy: "מעלית" },
  { key: "accessible", label: "נגישות", legacy: "נגישות" },
  { key: "safe_room", label: 'ממ"ד' },
  { key: "bbq", label: "מנגל" },
  { key: "private_entrance", label: "כניסה פרטית" },
];

/** מאפיינים בוליאניים שכבר קיימים כעמודות נפרדות (גינה/חצר וכו') */
export const COLUMN_FLAGS: { key: string; label: string }[] = [
  { key: "has_yard", label: "גינה / חצר" },
  { key: "has_trampoline", label: "טרמפולינה" },
  { key: "has_swing", label: "נדנדה" },
  { key: "has_parents_unit", label: "יחידת הורים" },
];

export interface SearchApt {
  name: string;
  address?: string | null;
  notes?: string | null;
  beds: number;
  rooms?: number | null;
  features?: string[] | null;
  amenities?: string[] | null;
  distance_from_tomb_m?: number | null;
  condition?: string | null;
  floor?: number | null;
  showers?: number | null;
  toilets?: number | null;
  living_room_sqm?: number | null;
  sofa_beds?: number | null;
  cribs?: number | null;
  parking_spots?: number | null;
  [k: string]: any;
}

export interface SearchQuery {
  guests: number;
  rooms: number;
  budget: number;          // סכום כולל לשהות, 0 = ללא
  text: string;            // חיפוש חופשי: שם / כתובת / הערות
  maxDistM: number;        // מרחק מקסימלי מהציון במטרים, 0 = ללא
  showers: number;
  toilets: number;
  sqm: number;
  sofaBeds: number;
  cribs: number;
  parking: number;
  condition: string;
  floor: number | null;
  flags: string[];         // מפתחות מ-AMENITIES ומ-COLUMN_FLAGS
}

export type GapLevel = "bad" | "gap" | "unknown";
export interface Gap { t: string; level: GapLevel }

export interface Evaluation {
  oks: string[];
  gaps: Gap[];
  score: number;
  hard: boolean;           // תפוסה מלאה: לא מוצגת
  partial: boolean;        // תפוסה חלקית: מוצגת אבל אי אפשר להזמין
  exact: boolean;
}

export interface EvalCtx {
  nights: number;
  busyNights: number;
  total: number | null;    // מחיר השהות, null אם אי אפשר לתמחר
}

export const NEAR_MAX_SCORE = 5;

const ILS = (n: number) => `${Math.round(n).toLocaleString("he-IL")} ₪`;

export function amenityHas(a: SearchApt, key: string): boolean | null {
  const col = COLUMN_FLAGS.find((c) => c.key === key);
  if (col) return !!a[key];
  const am = AMENITIES.find((x) => x.key === key);
  if (!am) return null;
  if ((a.amenities ?? []).includes(key)) return true;
  if (am.legacy && (a.features ?? []).includes(am.legacy)) return true;
  // לא הוזן שום מאפיין בדירה: אי אפשר לדעת, ולא נחשב "אין"
  return (a.amenities ?? []).length === 0 && (a.features ?? []).length === 0 ? null : false;
}

function labelOf(key: string) {
  return AMENITIES.find((x) => x.key === key)?.label ?? COLUMN_FLAGS.find((x) => x.key === key)?.label ?? key;
}

/** מספר הלילות בטווח [checkIn, checkOut) שתפוסים בלפחות אחד מהטווחים */
export function busyNightCount(checkIn: string, checkOut: string, ranges: { from: string; to: string }[]): number {
  let n = 0;
  for (let d = checkIn; d < checkOut; d = addDay(d)) if (ranges.some((r) => d >= r.from && d < r.to)) n++;
  return n;
}
function addDay(d: string) {
  return new Date(Date.parse(d + "T00:00:00Z") + 86400000).toISOString().slice(0, 10);
}

export function evaluate(a: SearchApt, q: SearchQuery, ctx: EvalCtx): Evaluation {
  const oks: string[] = [];
  const gaps: Gap[] = [];
  let score = 0;
  const gap = (t: string, s: number, level: GapLevel = "gap") => { gaps.push({ t, level }); score += s; };
  const missingScore = (m: number) => (m > 2 ? 9 : m);

  // זמינות ותפוסה חלקית
  let hard = false, partial = false;
  if (ctx.nights > 0 && ctx.busyNights >= ctx.nights) hard = true;
  else if (ctx.busyNights > 0) { partial = true; gap(`תפוסה ${ctx.busyNights} מתוך ${ctx.nights} לילות`, 3, "bad"); }
  else oks.push("פנויה בתאריכים");

  // מיטות
  if (q.guests) {
    if (a.beds >= q.guests) oks.push(`${a.beds} מיטות`);
    else { const m = q.guests - a.beds; gap(`חסרות ${m} מיטות (${a.beds} מתוך ${q.guests})`, missingScore(m)); }
  }
  // חדרים
  if (q.rooms) {
    const r = a.rooms ?? 0;
    if (a.rooms == null) gap("חדרים: לא הוזן", 0.5, "unknown");
    else if (r >= q.rooms) oks.push(`${r} חדרים`);
    else { const m = q.rooms - r; gap(`חסר ${m > 1 ? `${m} חדרים` : "חדר"} (${r} מתוך ${q.rooms})`, missingScore(m)); }
  }
  // מחיר
  if (q.budget) {
    if (ctx.total == null) gap("מחיר: לא ניתן לתמחר", 0.5, "unknown");
    else if (ctx.total <= q.budget) oks.push("בתקציב");
    else { const over = ctx.total - q.budget; gap(`יקרה ב־${ILS(over)} מהתקציב`, over / q.budget > 0.3 ? 9 : over / q.budget > 0.12 ? 2 : 1); }
  }
  // חיפוש חופשי
  const text = q.text.trim().toLowerCase();
  if (text) {
    const hay = `${a.name} ${a.address ?? ""} ${a.notes ?? ""}`.toLowerCase();
    if (text.split(/\s+/).every((w) => hay.includes(w))) oks.push("תואמת לחיפוש החופשי");
    else gap("לא תואמת לחיפוש החופשי", 1);
  }
  // מרחק מהציון
  if (q.maxDistM) {
    const d = a.distance_from_tomb_m;
    if (d == null) gap("מרחק: לא הוזן", 0.5, "unknown");
    else if (d <= q.maxDistM) oks.push(`${d} מ' מהציון`);
    else gap(`רחוקה ${d - q.maxDistM} מ' מעבר למבוקש (${d} מ')`, (d - q.maxDistM) / q.maxDistM > 0.5 ? 3 : 1);
  }
  // מספרים מינימליים
  const need = (v: number | null | undefined, min: number, label: string, short?: string) => {
    if (!min) return;
    if (v == null) gap(`${label}: לא הוזן`, 0.5, "unknown");
    else if (v >= min) oks.push(`${v} ${short ?? label}`);
    else gap(`יש ${v} ${short ?? label}, צריך ${min}`, min - v);
  };
  need(a.showers, q.showers, "מקלחות");
  need(a.toilets, q.toilets, "שירותים");
  need(a.living_room_sqm, q.sqm, 'מ"ר סלון', 'מ"ר סלון');
  need(a.sofa_beds, q.sofaBeds, "ספות נפתחות");
  // מיטת תינוק: המאפיין הישן "פורטבל / מיטת תינוק" נחשב כאחת
  const legacyCrib = (a.features ?? []).includes("פורטבל / מיטת תינוק") ? 1 : null;
  need(a.cribs ?? legacyCrib, q.cribs, "מיטות תינוק");
  need(a.parking_spots ?? ((a.features ?? []).includes("חניה") ? 1 : null), q.parking, "חניות");

  if (q.condition) {
    if (!a.condition) gap("מצב הדירה: לא הוזן", 0.5, "unknown");
    else if (a.condition === q.condition) oks.push("מצב מתאים");
    else gap("מצב הדירה שונה מהמבוקש", 1);
  }
  if (q.floor != null) {
    if (a.floor == null) gap("קומה: לא הוזנה", 0.5, "unknown");
    else if (a.floor === q.floor) oks.push(q.floor === 0 ? "קומת קרקע" : `קומה ${q.floor}`);
    else gap(`קומה ${a.floor}, ביקשו ${q.floor}`, 1);
  }
  // מאפיינים
  for (const k of q.flags) {
    const has = amenityHas(a, k);
    if (has === true) oks.push(labelOf(k));
    else if (has === null) gap(`${labelOf(k)}: לא הוזן`, 0.5, "unknown");
    else gap(`אין ${labelOf(k)}`, 1);
  }

  return { oks, gaps, score, hard, partial, exact: !gaps.length };
}

export type SortMode = "best" | "price" | "distance";

export interface Ranked<T> { item: T; ev: Evaluation; total: number | null }

/** מפצל למתאימות לגמרי ולכמעט מתאימות, וממיין. דירות רחוקות מדי מהמבוקש (ציון גבוה) נשמטות. */
export function rank<T extends { apt: SearchApt }>(
  rows: (T & { ev: Evaluation; total: number | null })[], guests: number, mode: SortMode,
): { exact: typeof rows; near: typeof rows } {
  const price = (r: { total: number | null }) => r.total ?? Number.MAX_SAFE_INTEGER;
  const dist = (r: { apt: SearchApt }) => r.apt.distance_from_tomb_m ?? Number.MAX_SAFE_INTEGER;
  const tight = (r: { apt: SearchApt }) => Math.max(0, r.apt.beds - guests); // התאמת מיטות הדוקה קודם
  const cmp = (x: (typeof rows)[number], y: (typeof rows)[number]) =>
    mode === "price" ? price(x) - price(y) || x.ev.score - y.ev.score
    : mode === "distance" ? dist(x) - dist(y) || x.ev.score - y.ev.score
    : x.ev.score - y.ev.score || tight(x) - tight(y) || price(x) - price(y);
  const live = rows.filter((r) => !r.ev.hard);
  return {
    exact: live.filter((r) => r.ev.exact).sort(mode === "best" ? (x, y) => tight(x) - tight(y) || price(x) - price(y) : cmp),
    near: live.filter((r) => !r.ev.exact && r.ev.score <= NEAR_MAX_SCORE).sort(cmp),
  };
}
