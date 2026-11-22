import type { SupabaseClient } from "@supabase/supabase-js";
import { addDays } from "./pricing";

/** פותח לילה: מסיר חסימה שמכסה אותו, ומפצל חסימה ארוכה לשני חלקים. מחזיר true אם משהו השתנה. */
export async function openNight(sb: SupabaseClient, apartmentId: string, day: string): Promise<boolean> {
  const { data } = await sb.from("blocks").select("*").eq("apartment_id", apartmentId).lte("date_from", day).gt("date_to", day).limit(1);
  const blk = data?.[0];
  if (!blk) return false;
  await sb.from("blocks").delete().eq("id", blk.id);
  if (blk.date_from < day) await sb.from("blocks").insert({ apartment_id: apartmentId, date_from: blk.date_from, date_to: day, source: blk.source, note: blk.note });
  if (addDays(day, 1) < blk.date_to) await sb.from("blocks").insert({ apartment_id: apartmentId, date_from: addDays(day, 1), date_to: blk.date_to, source: blk.source, note: blk.note });
  return true;
}

/** סוגר לילה. נכשל בשקט (false) אם הוא כבר תפוס או חסום. */
export async function closeNight(sb: SupabaseClient, apartmentId: string, day: string, source: string): Promise<boolean> {
  const { error } = await sb.from("blocks").insert({ apartment_id: apartmentId, date_from: day, date_to: addDays(day, 1), source });
  return !error;
}
