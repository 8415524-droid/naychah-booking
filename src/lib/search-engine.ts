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
  walk_minutes?: number | null;
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
  maxWalk: number;         // דקות הליכה מקסימליות מהציון, 0 = ללא
  showers: number;
  toilets: number;
  sqm: number;
  sofaBeds: number;
  cribs: number;
  parking: number;
  condition: string;
  floor: number | null;
  flags: string[];         // מפתחות מ-AMENITIES ומ-COLUMN_FLAGS
  must: string[];          // דרישות חובה (מפתח הדרישה): פער בהן נשקל פי 3 ודוחף את הדירה החוצה מ"כמעט מתאימות"
}

export type GapLevel = "bad" | "gap" | "unknown";
export interface Gap { t: string; level: GapLevel; must?: boolean }

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
  let key = "";
  const gap = (t: string, s: number, level: GapLevel = "gap") => {
    const must = q.must.includes(key) && level !== "unknown";
    gaps.push({ t, level, must }); score += must ? s * 3 : s;
  };
  const missingScore = (m: number) => (m > 2 ? 9 : m);

  // זמינות ותפוסה חלקית
  let hard = false, partial = false;
  if (ctx.nights > 0 && ctx.busyNights >= ctx.nights) hard = true;
  else if (ctx.busyNights > 0) { partial = true; gap(`תפוסה ${ctx.busyNights} מתוך ${ctx.nights} לילות`, 3, "bad"); }
  else if (ctx.nights > 0) oks.push("פנויה בתאריכים");

  // מיטות
  key = "guests";
  if (q.guests) {
    if (a.beds >= q.guests) oks.push(`${a.beds} מיטות`);
    else { const m = q.guests - a.beds; gap(`חסרות ${m} מיטות (${a.beds} מתוך ${q.guests})`, missingScore(m)); }
  }
  // חדרים
  key = "rooms";
  if (q.rooms) {
    const r = a.rooms ?? 0;
    if (a.rooms == null) gap("חדרים: לא הוזן", 0.5, "unknown");
    else if (r >= q.rooms) oks.push(`${r} חדרים`);
    else { const m = q.rooms - r; gap(`חסר ${m > 1 ? `${m} חדרים` : "חדר"} (${r} מתוך ${q.rooms})`, missingScore(m)); }
  }
  // מחיר
  key = "budget";
  if (q.budget && ctx.nights > 0) {
    if (ctx.total == null) gap("מחיר: לא ניתן לתמחר", 0.5, "unknown");
    else if (ctx.total <= q.budget) oks.push("בתקציב");
    else { const over = ctx.total - q.budget; gap(`יקרה ב־${ILS(over)} מהתקציב`, over / q.budget > 0.3 ? 9 : over / q.budget > 0.12 ? 2 : 1); }
  }
  // חיפוש חופשי
  key = "text";
  const text = q.text.trim().toLowerCase();
  if (text) {
    const hay = `${a.name} ${a.address ?? ""} ${a.notes ?? ""}`.toLowerCase();
    if (text.split(/\s+/).every((w) => hay.includes(w))) oks.push("תואמת לחיפוש החופשי");
    else gap("לא תואמת לחיפוש החופשי", 1);
  }
  // מרחק מהציון
  key = "dist";
  if (q.maxDistM) {
    const d = a.distance_from_tomb_m;
    if (d == null) gap("מרחק: לא הוזן", 0.5, "unknown");
    else if (d <= q.maxDistM) oks.push(`${d} מ' מהציון`);
    else gap(`רחוקה ${d - q.maxDistM} מ' מעבר למבוקש (${d} מ')`, (d - q.maxDistM) / q.maxDistM > 0.5 ? 3 : 1);
  }
  key = "walk";
  if (q.maxWalk) {
    const w = a.walk_minutes;
    if (w == null) gap("זמן הליכה: לא אותר", 0.5, "unknown");
    else if (w <= q.maxWalk) oks.push(`${w} דקות הליכה`);
    else gap(`${w} דקות הליכה, ביקשו עד ${q.maxWalk}`, (w - q.maxWalk) / q.maxWalk > 0.5 ? 3 : 1);
  }
  // מספרים מינימליים
  const need = (v: number | null | undefined, min: number, label: string, short?: string) => {
    if (!min) return;
    if (v == null) gap(`${label}: לא הוזן`, 0.5, "unknown");
    else if (v >= min) oks.push(`${v} ${short ?? label}`);
    else gap(`יש ${v} ${short ?? label}, צריך ${min}`, min - v);
  };
  key = "showers"; need(a.showers, q.showers, "מקלחות");
  key = "toilets"; need(a.toilets, q.toilets, "שירותים");
  key = "sqm"; need(a.living_room_sqm, q.sqm, 'מ"ר סלון', 'מ"ר סלון');
  key = "sofaBeds"; need(a.sofa_beds, q.sofaBeds, "ספות נפתחות");
  // מיטת תינוק: המאפיין הישן "פורטבל / מיטת תינוק" נחשב כאחת
  const legacyCrib = (a.features ?? []).includes("פורטבל / מיטת תינוק") ? 1 : null;
  key = "cribs"; need(a.cribs ?? legacyCrib, q.cribs, "מיטות תינוק");
  key = "parking"; need(a.parking_spots ?? ((a.features ?? []).includes("חניה") ? 1 : null), q.parking, "חניות");

  key = "condition";
  if (q.condition) {
    if (!a.condition) gap("מצב הדירה: לא הוזן", 0.5, "unknown");
    else if (a.condition === q.condition) oks.push("מצב מתאים");
    else gap("מצב הדירה שונה מהמבוקש", 1);
  }
  key = "floor";
  if (q.floor != null) {
    if (a.floor == null) gap("קומה: לא הוזנה", 0.5, "unknown");
    else if (a.floor === q.floor) oks.push(q.floor === 0 ? "קומת קרקע" : `קומה ${q.floor}`);
    else gap(`קומה ${a.floor}, ביקשו ${q.floor}`, 1);
  }
  // מאפיינים
  for (const k of q.flags) {
    key = k;
    const has = amenityHas(a, k);
    if (has === true) oks.push(labelOf(k));
    else if (has === null) gap(`${labelOf(k)}: לא הוזן`, 0.5, "unknown");
    else gap(`אין ${labelOf(k)}`, 1);
  }

  return { oks, gaps, score, hard, partial, exact: !gaps.length };
}

export type SortMode = "best" | "price" | "near";

export interface Ranked { apt: SearchApt & { id?: string }; ev: Evaluation; total: number | null }

/** שורה קצרה להקראה בטלפון: מה יש בדירה ומה חסר */
export function explain(a: SearchApt, ev: Evaluation): string {
  const bits = [`${a.beds} מיטות`];
  if (a.rooms != null) bits.push(`${a.rooms} חדרים`);
  if (a.walk_minutes != null) bits.push(`${a.walk_minutes} דקות הליכה מהציון`);
  else if (a.distance_from_tomb_m != null) bits.push(`${a.distance_from_tomb_m} מטר מהציון`);
  let t = bits.join(", ");
  const miss = ev.gaps.filter((g) => g.level !== "unknown").map((g) => g.t);
  if (!miss.length) t += ev.exact ? ", עונה על כל מה שביקשו" : "";
  else t += `. שימו לב: ${miss.slice(0, 3).join(", ")}`;
  return t;
}

/**
 * מפצל למתאימות לגמרי ולכמעט מתאימות, וממיין. דירות רחוקות מדי מהמבוקש נשמטות.
 * boost: מזהה דירה לערך (שלילי = עדיפות), לשבירת שוויון: לקוח חוזר, דירות שנסגרות הרבה.
 */
export function rank<T extends Ranked>(rows: T[], guests: number, mode: SortMode, boost: Map<string, number> = new Map()): { exact: T[]; near: T[] } {
  const price = (r: T) => r.total ?? Number.MAX_SAFE_INTEGER;
  // קרבה לציון: דקות הליכה אם יש, אחרת מטרים (כ-80 מטר לדקה)
  const dist = (r: T) => r.apt.walk_minutes ?? (r.apt.distance_from_tomb_m != null ? r.apt.distance_from_tomb_m / 80 : Number.MAX_SAFE_INTEGER);
  const tight = (r: T) => Math.max(0, r.apt.beds - guests); // התאמת מיטות הדוקה קודם
  const bo = (r: T) => boost.get(r.apt.id ?? "") ?? 0;
  const cmp = (x: T, y: T) =>
    mode === "price" ? price(x) - price(y) || x.ev.score - y.ev.score
    : mode === "near" ? dist(x) - dist(y) || x.ev.score - y.ev.score
    : x.ev.score + bo(x) - (y.ev.score + bo(y)) || tight(x) - tight(y) || price(x) - price(y);
  const live = rows.filter((r) => !r.ev.hard);
  const exact = live.filter((r) => r.ev.exact);
  return {
    exact: exact.sort(mode === "best" ? (x, y) => bo(x) - bo(y) || tight(x) - tight(y) || price(x) - price(y) : cmp),
    near: live.filter((r) => !r.ev.exact && r.ev.score <= NEAR_MAX_SCORE).sort(cmp),
  };
}

export interface SplitOption { a: Ranked; b: Ranked; beds: number; total: number; gapM: number }

/** אין דירה אחת: שתי דירות פנויות וקרובות זו לזו שיחד מכילות את כולם. מרחק ידוע לשתיהן בלבד. */
export function findSplits(rows: Ranked[], guests: number, maxGapM = 400, limit = 3): SplitOption[] {
  if (guests < 2) return [];
  const ok = rows.filter((r) => !r.ev.hard && !r.ev.partial && r.total != null && r.apt.distance_from_tomb_m != null);
  const out: SplitOption[] = [];
  for (let i = 0; i < ok.length; i++) for (let j = i + 1; j < ok.length; j++) {
    const x = ok[i], y = ok[j];
    if (x.apt.beds >= guests || y.apt.beds >= guests) continue;
    if (x.apt.beds + y.apt.beds < guests) continue;
    const gapM = Math.abs(x.apt.distance_from_tomb_m! - y.apt.distance_from_tomb_m!);
    if (gapM > maxGapM) continue;
    out.push({ a: x, b: y, beds: x.apt.beds + y.apt.beds, total: x.total! + y.total!, gapM });
  }
  return out.sort((p, q) => (p.beds - guests) - (q.beds - guests) || p.gapM - q.gapM || p.total - q.total).slice(0, limit);
}
