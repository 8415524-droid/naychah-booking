"use client";
import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

/** יציאה מחלונית "הזמנה חדשה": מנווט את החלון הראשי לכתובת פנימית (ולא בתוך המסגרת). */
function Go() {
  const to = useSearchParams().get("to") ?? "/bookings";
  const safe = to.startsWith("/") && !to.startsWith("//") ? to : "/bookings";
  useEffect(() => { (window.top ?? window).location.href = safe; }, [safe]);
  return <p className="muted">מעביר…</p>;
}
export default function GoPage() { return <Suspense><Go /></Suspense>; }
