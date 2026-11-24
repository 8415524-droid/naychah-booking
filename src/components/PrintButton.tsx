"use client";
export default function PrintButton({ label = "הדפס או שמור כ-PDF" }: { label?: string }) {
  return <button type="button" className="btn print-hide" onClick={() => window.print()}>{label}</button>;
}
