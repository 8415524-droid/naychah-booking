/** גלריית דירה: סוגי קבצים, מגבלות ונתיב אחסון. לוגיקה טהורה, נבדקת ב-media.test.ts. */
export const MEDIA_BUCKET = "apartment-media";
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
export const MAX_VIDEO_BYTES = 50 * 1024 * 1024;
export const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
export const VIDEO_TYPES = ["video/mp4", "video/quicktime", "video/webm"];

export function mediaKind(contentType: string): "image" | "video" | null {
  if (IMAGE_TYPES.includes(contentType)) return "image";
  if (VIDEO_TYPES.includes(contentType)) return "video";
  return null;
}

/** null = תקין, אחרת הסבר בעברית. */
export function checkMediaFile(contentType: string, size: number): string | null {
  const kind = mediaKind(contentType);
  if (!kind) return "סוג קובץ לא נתמך (תמונה JPG/PNG/WEBP או סרטון MP4/MOV/WEBM)";
  if (!(size > 0)) return "הקובץ ריק";
  if (kind === "image" && size > MAX_IMAGE_BYTES) return "תמונה גדולה מ-10MB";
  if (kind === "video" && size > MAX_VIDEO_BYTES) return "סרטון גדול מ-50MB";
  return null;
}

export function mediaPath(apartmentId: string, fileName: string, rand: string): string {
  const ext = (/\.([a-z0-9]{2,5})$/i.exec(fileName)?.[1] ?? "bin").toLowerCase();
  return `${apartmentId}/${rand}.${ext}`;
}

export function mediaUrl(base: string, path: string): string {
  return `${base}/storage/v1/object/public/${MEDIA_BUCKET}/${path}`;
}
