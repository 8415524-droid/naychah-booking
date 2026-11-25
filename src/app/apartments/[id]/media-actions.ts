"use server";
import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth";
import { adminClient } from "@/lib/supabase/admin";
import { MEDIA_BUCKET, checkMediaFile, mediaKind, mediaPath } from "@/lib/media";

type Res<T = object> = ({ ok: true } & T) | { ok: false; error: string };

/** שלב 1: אישור הרשאה וקבלת כתובת העלאה חד-פעמית. הקובץ עצמו עולה ישירות לאחסון, בלי לעבור בשרת. */
export async function createMediaUpload(apartmentId: string, fileName: string, contentType: string, size: number): Promise<Res<{ path: string; token: string }>> {
  const { supabase } = await getSession(["admin", "owner"]);
  const bad = checkMediaFile(contentType, size);
  if (bad) return { ok: false, error: bad };
  const { data: apt } = await supabase.from("apartments").select("id").eq("id", apartmentId).single(); // בעל דירה: רק שלו (RLS)
  if (!apt) return { ok: false, error: "אין הרשאה לדירה הזו" };
  const path = mediaPath(apartmentId, fileName, randomUUID());
  const { data, error } = await adminClient().storage.from(MEDIA_BUCKET).createSignedUploadUrl(path);
  if (error || !data) return { ok: false, error: "יצירת ההעלאה נכשלה. ייתכן שהמאגר טרם הוקם" };
  return { ok: true, path, token: data.token };
}

/** שלב 2: אחרי שהקובץ עלה, רושמים אותו בגלריה. */
export async function registerMedia(apartmentId: string, path: string, contentType: string): Promise<Res> {
  const { supabase } = await getSession(["admin", "owner"]);
  const kind = mediaKind(contentType);
  if (!kind || !path.startsWith(`${apartmentId}/`)) return { ok: false, error: "בקשה לא תקינה" };
  const { error } = await supabase.from("apartment_media").insert({ apartment_id: apartmentId, path, kind });
  if (error) return { ok: false, error: "השמירה נכשלה" };
  revalidatePath(`/apartments/${apartmentId}`);
  return { ok: true };
}

export async function deleteMedia(fd: FormData) {
  const { supabase } = await getSession(["admin", "owner"]);
  const id = String(fd.get("id"));
  const { data: row } = await supabase.from("apartment_media").select("path, apartment_id").eq("id", id).single();
  if (!row) return;
  const { error } = await supabase.from("apartment_media").delete().eq("id", id);
  if (!error) await adminClient().storage.from(MEDIA_BUCKET).remove([row.path]);
  revalidatePath(`/apartments/${row.apartment_id}`);
}
