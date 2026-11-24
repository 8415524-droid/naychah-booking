"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

type Hit = { kind: string; label: string; sub?: string; href: string };

// חיפוש גלובלי (Ctrl+K): דירות, לקוחות, בעלי דירות ועמודים.
export default function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setOpen(true); }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, []);
  useEffect(() => { if (open) setTimeout(() => input.current?.focus(), 30); else { setQ(""); setHits([]); } }, [open]);

  useEffect(() => {
    if (!open) return;
    const term = q.trim();
    if (term.length < 2) { setHits([]); return; }
    setBusy(true);
    const ctl = new AbortController();
    const t = setTimeout(() => {
      fetch(`/api/search?q=${encodeURIComponent(term)}`, { signal: ctl.signal })
        .then((r) => (r.ok ? r.json() : { hits: [] }))
        .then((d) => setHits(d.hits ?? []))
        .catch(() => {})
        .finally(() => setBusy(false));
    }, 200);
    return () => { clearTimeout(t); ctl.abort(); };
  }, [q, open]);

  return (
    <>
      <button type="button" className="search-btn" onClick={() => setOpen(true)} aria-label="חיפוש הזמנה">
        <span aria-hidden>🔎</span><span className="search-btn-text">חיפוש הזמנה</span><kbd>Ctrl+K</kbd>
      </button>
      {open && (
        <div className="gs-scrim" onClick={() => setOpen(false)}>
          <div className="gs" role="dialog" aria-label="חיפוש גלובלי" onClick={(e) => e.stopPropagation()}>
            <input ref={input} value={q} onChange={(e) => setQ(e.target.value)} placeholder="חפש הזמנה לפי שם לקוח, טלפון או מספר הזמנה. אפשר גם דירה או בעל דירה…" />
            <div className="gs-list">
              {q.trim().length < 2 && <p className="muted">הקלד לפחות שתי אותיות.</p>}
              {q.trim().length >= 2 && !busy && hits.length === 0 && <p className="muted">לא נמצא כלום.</p>}
              {hits.map((h, i) => (
                <Link key={i} href={h.href} className="gs-hit" onClick={() => setOpen(false)}>
                  <span className="gs-kind">{h.kind}</span><span>{h.label}</span>{h.sub && <span className="muted">{h.sub}</span>}
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
