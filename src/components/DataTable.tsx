"use client";
import { useMemo, useState, useTransition } from "react";

export type Col = { key: string; label: string; filter?: boolean };
export type Cell = { text: string; node?: React.ReactNode };
export type Row = { id: string; cells: Record<string, Cell> };

// טבלה עם סינון לפי עמודה (כמו באקסל: ערכים עם ספירה, בחירה מרובה),
// בחירת שורות, וייצוא CSV של הנבחרות. פעולה מותאמת (למשל מחיקה) מועברת כפעולת שרת.
export default function DataTable({ columns, rows, empty = "אין נתונים.", filename = "export", bulkAction }: {
  columns: Col[]; rows: Row[]; empty?: string; filename?: string;
  bulkAction?: { label: string; confirm: string; run: (ids: string[]) => Promise<void> };
}) {
  const [filters, setFilters] = useState<Record<string, string[]>>({});
  const [openCol, setOpenCol] = useState<string | null>(null);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [pending, start] = useTransition();

  const visible = useMemo(
    () => rows.filter((r) => Object.entries(filters).every(([k, vals]) => !vals.length || vals.includes(r.cells[k]?.text ?? ""))),
    [rows, filters],
  );
  const visibleIds = visible.map((r) => r.id);
  const selected = visibleIds.filter((id) => sel.has(id));
  const allOn = visible.length > 0 && selected.length === visible.length;

  function values(key: string) {
    const m = new Map<string, number>();
    for (const r of rows) { const v = r.cells[key]?.text ?? ""; m.set(v, (m.get(v) ?? 0) + 1); }
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0], "he"));
  }
  function toggleVal(key: string, v: string) {
    setFilters((f) => {
      const cur = f[key] ?? [];
      return { ...f, [key]: cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v] };
    });
  }
  function exportCsv() {
    const q = (s: string) => `"${s.replace(/"/g, '""')}"`;
    const lines = [columns.map((c) => q(c.label)).join(",")];
    for (const r of visible) if (sel.has(r.id)) lines.push(columns.map((c) => q(r.cells[c.key]?.text ?? "")).join(","));
    const blob = new Blob(["﻿" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = `${filename}.csv`; a.click();
    URL.revokeObjectURL(a.href);
  }
  const activeCount = Object.values(filters).filter((v) => v.length).length;

  return (
    <div className="dt">
      {activeCount > 0 && (
        <p className="muted">מוצגות {visible.length} מתוך {rows.length} · <button type="button" className="linkbtn" onClick={() => setFilters({})}>נקה סינון</button></p>
      )}
      <div className="dt-wrap">
        <table>
          <thead>
            <tr>
              <th className="dt-chk"><input type="checkbox" aria-label="בחר הכול" checked={allOn}
                onChange={() => setSel(allOn ? new Set([...sel].filter((id) => !visibleIds.includes(id))) : new Set([...sel, ...visibleIds]))} /></th>
              {columns.map((c) => (
                <th key={c.key}>
                  {c.label}
                  {c.filter && (
                    <span className="cf">
                      <button type="button" className={`cf-btn${filters[c.key]?.length ? " cf-on" : ""}`} aria-label={`סינון לפי ${c.label}`}
                        onClick={() => setOpenCol(openCol === c.key ? null : c.key)}>▾</button>
                      {openCol === c.key && (
                        <div className="cf-pop">
                          {values(c.key).map(([v, n]) => (
                            <label key={v} className="cf-opt">
                              <input type="checkbox" checked={(filters[c.key] ?? []).includes(v)} onChange={() => toggleVal(c.key, v)} />
                              <span>{v || "(ריק)"}</span><span className="muted">{n}</span>
                            </label>
                          ))}
                        </div>
                      )}
                    </span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map((r) => (
              <tr key={r.id} className={sel.has(r.id) ? "dt-sel" : ""}>
                <td className="dt-chk"><input type="checkbox" aria-label="בחר שורה" checked={sel.has(r.id)}
                  onChange={() => setSel((s) => { const n = new Set(s); if (n.has(r.id)) n.delete(r.id); else n.add(r.id); return n; })} /></td>
                {columns.map((c) => <td key={c.key}>{r.cells[c.key]?.node ?? r.cells[c.key]?.text}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {visible.length === 0 && <p className="muted">{rows.length ? "אין שורות שתואמות את הסינון." : empty}</p>}
      {selected.length > 0 && (
        <div className="bulkbar">
          <strong>{selected.length === 1 ? "נבחרה שורה אחת" : `נבחרו ${selected.length} שורות`}</strong>
          <button type="button" className="btn" onClick={exportCsv}>ייצוא ל-CSV</button>
          {bulkAction && (
            <button type="button" className="danger" disabled={pending}
              onClick={() => { if (confirm(`${bulkAction.confirm} (${selected.length})`)) start(async () => { await bulkAction.run(selected); setSel(new Set()); }); }}>
              {bulkAction.label}
            </button>
          )}
          <button type="button" className="linkbtn" onClick={() => setSel(new Set())}>נקה בחירה</button>
        </div>
      )}
    </div>
  );
}
