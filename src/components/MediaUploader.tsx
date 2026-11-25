"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { MEDIA_BUCKET, checkMediaFile } from "@/lib/media";
import { createMediaUpload, registerMedia } from "@/app/apartments/[id]/media-actions";

export default function MediaUploader({ apartmentId }: { apartmentId: string }) {
  const input = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true); setMsg("");
    const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!);
    const errors: string[] = [];
    let done = 0;
    for (const file of Array.from(files)) {
      setMsg(`מעלה ${done + 1} מתוך ${files.length}: ${file.name}`);
      const bad = checkMediaFile(file.type, file.size);
      if (bad) { errors.push(`${file.name}: ${bad}`); continue; }
      const up = await createMediaUpload(apartmentId, file.name, file.type, file.size);
      if (!up.ok) { errors.push(`${file.name}: ${up.error}`); continue; }
      const { error } = await sb.storage.from(MEDIA_BUCKET).uploadToSignedUrl(up.path, up.token, file, { contentType: file.type });
      if (error) { errors.push(`${file.name}: ההעלאה נכשלה`); continue; }
      const reg = await registerMedia(apartmentId, up.path, file.type);
      if (!reg.ok) { errors.push(`${file.name}: ${reg.error}`); continue; }
      done++;
    }
    setBusy(false);
    setMsg(errors.length ? `הועלו ${done}. בעיות: ${errors.join(" · ")}` : `הועלו ${done} קבצים`);
    if (input.current) input.current.value = "";
    router.refresh();
  }

  return (
    <div>
      <input ref={input} type="file" multiple accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/quicktime,video/webm"
        disabled={busy} onChange={(e) => void upload(e.target.files)} />
      <p className="muted">תמונות עד 10MB וסרטונים עד 50MB (MP4, MOV, WEBM). אפשר לבחור כמה קבצים יחד.</p>
      {msg && <p role="status">{msg}</p>}
    </div>
  );
}
