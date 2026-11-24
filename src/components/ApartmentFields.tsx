import { AMENITIES } from "@/lib/search-engine";
import { CONDITION_HE, DOW_HE, EXTRAS, FEATURES } from "@/lib/labels";

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
      <h3>פרטי הדירה</h3>
      <div className="checks">
        {EXTRAS.map((e) => (
          <label key={e.key}><input type="checkbox" name={e.key} defaultChecked={!!apt?.[e.key]} /> {e.label}</label>
        ))}
      </div>
      <h3>מאפייני חיפוש</h3>
      <div className="checks">
        {AMENITIES.map((a) => (
          <label key={a.key}><input type="checkbox" name="amenities" value={a.key} defaultChecked={(apt?.amenities ?? []).includes(a.key)} /> {a.label}</label>
        ))}
      </div>
      <div className="grid2">
        <div><label>ספות נפתחות</label><input name="sofa_beds" type="number" min={0} defaultValue={apt?.sofa_beds ?? ""} /></div>
        <div><label>מיטות תינוק</label><input name="cribs" type="number" min={0} defaultValue={apt?.cribs ?? ""} /></div>
        <div><label>חניות</label><input name="parking_spots" type="number" min={0} defaultValue={apt?.parking_spots ?? ""} /></div>
      </div>
      <div className="grid2">
        <div><label>גודל סלון (מ"ר)</label><input name="living_room_sqm" type="number" min={1} defaultValue={apt?.living_room_sqm ?? ""} /></div>
        <div>
          <label>מצב הדירה</label>
          <select name="condition" defaultValue={apt?.condition ?? ""}>
            <option value="">לא צוין</option>
            {Object.entries(CONDITION_HE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <div><label>קומה (0 = קרקע)</label><input name="floor" type="number" defaultValue={apt?.floor ?? ""} /></div>
        <div><label>מספר מקלחות</label><input name="showers" type="number" min={0} defaultValue={apt?.showers ?? ""} /></div>
        <div><label>מספר שירותים</label><input name="toilets" type="number" min={0} defaultValue={apt?.toilets ?? ""} /></div>
      </div>
      <label>הערות</label>
      <textarea name="notes" rows={3} defaultValue={apt?.notes ?? ""} />
      <label>כתובת יומן חיצוני לייבוא (iCal, https)</label>
      <input name="ical_import_url" defaultValue={apt?.ical_import_url ?? ""} placeholder="https://calendar.google.com/calendar/ical/.../basic.ics" />
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
    has_yard: fd.get("has_yard") === "on",
    has_trampoline: fd.get("has_trampoline") === "on",
    has_swing: fd.get("has_swing") === "on",
    has_parents_unit: fd.get("has_parents_unit") === "on",
    living_room_sqm: num("living_room_sqm"),
    condition: String(fd.get("condition") || "") || null,
    floor: fd.get("floor") === "" || fd.get("floor") == null ? null : Number(fd.get("floor")),
    showers: num("showers"),
    toilets: num("toilets"),
    features: fd.getAll("features").map(String),
    amenities: fd.getAll("amenities").map(String).filter((k) => AMENITIES.some((a) => a.key === k)),
    sofa_beds: fd.get("sofa_beds") === "" ? null : num("sofa_beds"),
    cribs: fd.get("cribs") === "" ? null : num("cribs"),
    parking_spots: fd.get("parking_spots") === "" ? null : num("parking_spots"),
    notes: String(fd.get("notes") || "") || null,
    ical_import_url: String(fd.get("ical_import_url") || "").trim() || null,
    early_cutoff_dow: Number(fd.get("early_cutoff_dow")),
    early_cutoff_time: String(fd.get("early_cutoff_time") || "12:00"),
    single_night_opens_dow: Number(fd.get("single_night_opens_dow")),
    single_night_opens_time: String(fd.get("single_night_opens_time") || "18:00"),
  };
}
