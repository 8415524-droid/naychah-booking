"use client";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

/** כפתור צף "הזמנה חדשה" בכל המסכים (כמו במערכת הישנה): פותח חלונית צד עם חיפוש הדירה, בלי לעזוב את המסך. */
export default function NewBookingPanel() {
  const [open, setOpen] = useState(false);
  const path = usePathname();
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, []);
  if (path.startsWith("/search")) return null;
  return (
    <>
      <button type="button" className="qfab" aria-label="הזמנה חדשה, חיפוש לפי הצורך" onClick={() => setOpen(true)}>＋ הזמנה חדשה</button>
      {open && (
        <div className="qwrap" onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}>
          <div className="qpanel" role="dialog" aria-label="הזמנה חדשה">
            <div className="qhead"><h2>הזמנה חדשה · חיפוש לפי הצורך</h2><button type="button" className="btn" onClick={() => setOpen(false)}>סגור</button></div>
            <iframe className="qframe" src="/search?embed=1" title="הזמנה חדשה" />
          </div>
        </div>
      )}
    </>
  );
}
