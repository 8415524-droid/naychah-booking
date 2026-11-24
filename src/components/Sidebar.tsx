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
          {groups.map((g) => (
            <div key={g.title} className="side-group">
              <div className="side-title">{g.title}</div>
              {g.items.map((it) => {
                const cls = `side-link${isActive(pathname, it.href) && !it.external ? " side-link--on" : ""}`;
                const inner = <><span className="side-ico" aria-hidden>{it.icon}</span><span className="side-label">{it.label}</span></>;
                return it.external
                  ? <a key={it.href} href={it.href} className={cls} title={it.label}>{inner}</a>
                  : <Link key={it.href} href={it.href} className={cls} title={it.label}>{inner}</Link>;
              })}
            </div>
          ))}
        </nav>
        <button type="button" className="side-collapse" onClick={toggle} aria-label={collapsed ? "הרחב תפריט" : "כווץ תפריט"}>
          {collapsed ? "»" : "«"}
        </button>
      </aside>
    </>
  );
}
