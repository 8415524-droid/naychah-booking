"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import type { NavGroup } from "@/lib/nav";
import { isActive } from "@/lib/nav";

const KEY = "naychah_sidebar_collapsed";

// תפריט צד: מתקפל לאייקונים (נשמר בדפדפן), ובטלפון נפתח כמגירה.
export default function Sidebar({ groups }: { groups: NavGroup[] }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [open, setOpen] = useState(false);
  const [opened, setOpened] = useState<Set<string>>(new Set());
  function toggleGroup(t: string) {
    setOpened((o) => { const n = new Set(o); if (n.has(t)) n.delete(t); else n.add(t); return n; });
  }

  useEffect(() => {
    try { setCollapsed(localStorage.getItem(KEY) === "1"); } catch {}
  }, []);
  useEffect(() => { setOpen(false); }, [pathname]);
  useEffect(() => {
    const h = () => setOpen((o) => !o);
    window.addEventListener("naychah:toggle-menu", h);
    return () => window.removeEventListener("naychah:toggle-menu", h);
  }, []);

  function toggle() {
    const v = !collapsed;
    setCollapsed(v);
    try { localStorage.setItem(KEY, v ? "1" : "0"); } catch {}
  }

  return (
    <>
      {open && <div className="side-scrim" onClick={() => setOpen(false)} />}
      <aside className={`side${collapsed ? " side--min" : ""}${open ? " side--open" : ""}`} aria-label="תפריט ראשי">
        <nav>
          {groups.map((g) => {
            const hasActive = g.items.some((it) => !it.external && isActive(pathname, it.href));
            // מכווץ בברירת מחדל; הקבוצה של העמוד הנוכחי נפתחת. במצב אייקונים הכול גלוי.
            const expanded = g.pinned || collapsed || opened.has(g.title) || hasActive;
            return (
              <div key={g.title} className="side-group">
                {g.pinned ? <div className="side-title">{g.title}</div> : (
                  <button type="button" className="side-head" aria-expanded={expanded} onClick={() => toggleGroup(g.title)}>
                    <span className="side-label">{g.title}</span>
                    <span className="side-count">{g.items.length}</span>
                    <span className="side-chev" aria-hidden>{expanded ? "▴" : "▾"}</span>
                  </button>
                )}
                {expanded && g.items.map((it) => {
                  const cls = `side-link${isActive(pathname, it.href) && !it.external ? " side-link--on" : ""}`;
                  const inner = <><span className="side-ico" aria-hidden>{it.icon}</span><span className="side-label">{it.label}</span></>;
                  return it.external
                    ? <a key={it.href} href={it.href} className={cls} title={it.label}>{inner}</a>
                    : <Link key={it.href} href={it.href} className={cls} title={it.label}>{inner}</Link>;
                })}
              </div>
            );
          })}
        </nav>
        <button type="button" className="side-collapse" onClick={toggle} aria-label={collapsed ? "הרחב תפריט" : "כווץ תפריט"}>
          {collapsed ? "»" : "«"}
        </button>
      </aside>
    </>
  );
}
