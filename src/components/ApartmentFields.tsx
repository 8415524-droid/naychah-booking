import { DOW_HE, FEATURES } from "@/lib/labels";

type Apt = Record<string, any> | null;

export default function ApartmentFields({ apt }: { apt: Apt }) {
  const feats: string[] = apt?.features ?? [];
  return (
    <>
      <div className="grid2">
        <div><label>שם / כינוי הדירה</label><input name="name" defaultValue={apt?.name ?? ""} required /></div>
        <div><label>כתובת</label><input name="address" defaultValue={apt?.address ?? ""} /></div>
        <div><label>מספר מיטות</label><input name="beds" type="number" min={1} defaultValue={apt?.beds ?? ""} required /></div>
        <div><label>חדרים</label><input name="rooms" type="number" min={0} defaultValue={apt?.rooms ?? ""} /></div>
        <div><label>מרחק מהציון (במטרים)</label><input name="distance_from_tomb_m" type="number" min={0} defaultValue={apt?.distance_from_tomb_m ?? ""} /></div>
        <div><label>מספר דירה קצר למרכזייה</label><input name="short_code" type="number" min={1} defaultValue={apt?.short_code ?? ""} /></div>
        <div><label>איש קשר במקום</label><input name="onsite_contact" defaultValue={apt?.onsite_contact ?? ""} /></div>
      </div>
      <label>מאפיינים</label>
      <div className="checks">
        {FEATURES.map((f) => (
          <label key={f}><input type="checkbox" name="features" value={f} defaultChecked={feats.includes(f)} /> {f}</label>
        ))}
      </div>
      <label>הערות</label>
      <textarea name="notes" rows={3} defaultValue={apt?.notes ?? ""} />
      <h3>שעות סף (כל בעל דירה קובע לעצמו)</h3>
      <div className="grid2">
        <div>
          <label>סוגרים במחיר המוזל עד יום</label>
          <select name="early_cutoff_dow" defaultValue={apt?.early_cutoff_dow ?? 4}>
            {DOW_HE.map((d, i) => <option key={i} value={i}>{d}</option>)}
          </select>
        </div>
        <div><label>עד השעה</label><input type="time" name="early_cutoff_time" defaultValue={(apt?.early_cutoff_time ?? "12:00").slice(0, 5)} /></div>
        <div>
          <label>לילה בודד נפתח ביום</label>
          <select name="single_night_opens_dow" defaultValue={apt?.single_night_opens_dow ?? 4}>
            {DOW_HE.map((d, i) => <option key={i} value={i}>{d}</option>)}
          </select>
        </div>
        <div><label>בשעה</label><input type="time" name="single_night_opens_time" defaultValue={(apt?.single_night_opens_time ?? "18:00").slice(0, 5)} /></div>
      </div>
    </>
  );
}

export function parseApartment(fd: FormData) {
  const num = (k: string) => (fd.get(k) ? Number(fd.get(k)) : null);
  return {
    name: String(fd.get("name") || "").trim(),
    address: String(fd.get("address") || "") || null,
    beds: Number(fd.get("beds")),
    rooms: num("rooms"),
    distance_from_tomb_m: num("distance_from_tomb_m"),
    short_code: num("short_code"),
    onsite_contact: String(fd.get("onsite_contact") || "") || null,
    features: fd.getAll("features").map(String),
    notes: String(fd.get("notes") || "") || null,
    early_cutoff_dow: Number(fd.get("early_cutoff_dow")),
    early_cutoff_time: String(fd.get("early_cutoff_time") || "12:00"),
    single_night_opens_dow: Number(fd.get("single_night_opens_dow")),
    single_night_opens_time: String(fd.get("single_night_opens_time") || "18:00"),
  };
}
