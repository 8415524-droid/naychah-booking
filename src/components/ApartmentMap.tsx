"use client";
import { useState } from "react";

// מפת גוגל בהטמעה ללא מפתח API. הכתובת נשלחת לגוגל רק כשלוחצים להצגה.
export function mapQuery(address?: string | null, name?: string | null) {
  const base = (address ?? "").trim() || (name ?? "").trim();
  return base ? `${base}, מירון` : "מירון";
}

export default function ApartmentMap({ address, name, lat, lng, defaultOpen = false }: { address?: string | null; name?: string | null; lat?: number | null; lng?: number | null; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const q = encodeURIComponent(lat != null && lng != null ? `${lat},${lng}` : mapQuery(address, name));
  return (
    <div className="map-box">
      <div className="row">
        <button type="button" className="btn" onClick={() => setOpen(!open)}>{open ? "הסתר מפה" : "הצג מפה"}</button>
        <a href={`https://www.google.com/maps/search/?api=1&query=${q}`} target="_blank" rel="noreferrer">פתיחה בגוגל מפות</a>
      </div>
      {open && (
        <iframe
          className="map-frame"
          title={`מפה: ${name ?? ""}`}
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          src={`https://maps.google.com/maps?q=${q}&hl=he&z=16&output=embed`}
        />
      )}
    </div>
  );
}
