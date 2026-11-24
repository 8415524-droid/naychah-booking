export const ROLE_HE: Record<string, string> = { admin: "מנהל", agent: "טלפנית", owner: "בעל דירה", partner: "שותף (צפייה בכספים)", vendor: "ספק תחזוקה", none: "ללא הרשאה" };

export const PERIOD_HE: Record<string, string> = {
  thu_sat: "חמישי עד שבת",
  fri_sat: "שישי עד שבת",
  single_night: "לילה בודד",
  midweek: "אמצע שבוע",
  special: "תקופה מיוחדת (חג / ל\"ג בעומר)",
};

export const DOW_HE = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];

export const FEATURES = ["מזגן", "מרפסת", "נגישות", "מעלית", "חניה", "מטבח כשר מהודר", "פורטבל / מיטת תינוק"];

export const CONDITION_HE: Record<string, string> = { new: "חדש", medium: "בינוני", luxurious: "מפואר", weak: "חלש", reasonable: "סביר" };

export const EXTRAS: { key: string; label: string }[] = [
  { key: "has_yard", label: "חצר" },
  { key: "has_trampoline", label: "טרמפולינה" },
  { key: "has_swing", label: "נדנדה" },
  { key: "has_parents_unit", label: "יחידת הורים" },
];

/** שורת תיאור קצרה של פרטי הדירה, לתצוגה לטלפנית */
export function detailsLine(a: Record<string, any>): string {
  const parts: string[] = [];
  if (a.floor != null) parts.push(a.floor === 0 ? "קומת קרקע" : `קומה ${a.floor}`);
  if (a.condition) parts.push(`מצב: ${CONDITION_HE[a.condition]}`);
  if (a.living_room_sqm != null) parts.push(`סלון ${a.living_room_sqm} מ"ר`);
  if (a.showers != null) parts.push(`${a.showers} מקלחות`);
  if (a.toilets != null) parts.push(`${a.toilets} שירותים`);
  for (const e of EXTRAS) if (a[e.key]) parts.push(e.label);
  return parts.join(" · ");
}
