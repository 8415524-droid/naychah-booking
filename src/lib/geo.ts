// איתור דירות ומרחק הליכה מהציון, בשירותים חופשיים של OpenStreetMap (בלי מפתח).
// קבר רשב"י במירון (כפי שמופיע ב-OpenStreetMap).
export const TZIYUN = { lat: 32.9807826, lng: 35.4406511 };

const UA = "naychah-booking (meron apartments)";
// תיבת חיפוש סביב מירון: מערב, צפון, מזרח, דרום.
const MERON_BOX = "35.41,33.00,35.47,32.96";

export type Coords = { lat: number; lng: number };

// מקבל "32.98,35.44", או קישור/טקסט של גוגל מפות ("@32.98,35.44" או "!3d32.98!4d35.44").
export function parseCoords(input: string): Coords | null {
  const s = input.trim();
  const patterns = [/@(-?\d+\.\d+),\s*(-?\d+\.\d+)/, /!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/, /^(-?\d+\.\d+)[\s,;]+(-?\d+\.\d+)$/];
  for (const re of patterns) {
    const m = s.match(re);
    if (m) {
      const lat = Number(m[1]), lng = Number(m[2]);
      if (Math.abs(lat) <= 90 && Math.abs(lng) <= 180) return { lat, lng };
    }
  }
  return null;
}

export function walkLabel(minutes: number | null | undefined) {
  if (minutes == null) return "";
  return minutes <= 1 ? "דקה הליכה מהציון" : `${minutes} דקות הליכה מהציון`;
}

export async function geocode(address: string): Promise<Coords | null> {
  const q = address.includes("מירון") ? address : `${address}, מירון`;
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=il&viewbox=${MERON_BOX}&bounded=1&q=${encodeURIComponent(q)}`;
  const res = await fetch(url, { headers: { "User-Agent": UA }, cache: "no-store" });
  if (!res.ok) return null;
  const j = (await res.json()) as { lat: string; lon: string }[];
  return j[0] ? { lat: Number(j[0].lat), lng: Number(j[0].lon) } : null;
}

export async function walkToTziyun(from: Coords): Promise<{ minutes: number; meters: number } | null> {
  const url = `https://routing.openstreetmap.de/routed-foot/route/v1/foot/${from.lng},${from.lat};${TZIYUN.lng},${TZIYUN.lat}?overview=false`;
  const res = await fetch(url, { headers: { "User-Agent": UA }, cache: "no-store" });
  if (!res.ok) return null;
  const j = (await res.json()) as { code: string; routes?: { duration: number; distance: number }[] };
  const r = j.routes?.[0];
  if (j.code !== "Ok" || !r) return null;
  return { minutes: Math.max(1, Math.ceil(r.duration / 60)), meters: Math.round(r.distance) };
}
