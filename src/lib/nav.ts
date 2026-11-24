import type { Role } from "@/lib/auth";

export type NavItem = { href: string; label: string; icon: string; external?: boolean };
export type NavGroup = { title: string; items: NavItem[] };

// תפריט הצד, מקובץ לפי נושאים ומסונן לפי תפקיד (כמו באתר הדירות).
export function navGroups(role: Role): NavGroup[] {
  const staff = role === "admin" || role === "agent";
  const admin = role === "admin";
  const groups: NavGroup[] = [
    { title: "ראשי", items: [
      { href: "/", label: "בית", icon: "🏠" },
      ...(staff ? [{ href: "/search", label: "חיפוש דירה", icon: "🔎" }] : []),
    ] },
    { title: "הזמנות", items: [
      ...(role !== "none" ? [{ href: "/bookings", label: "הזמנות", icon: "📅" }] : []),
      ...(staff ? [{ href: "/customers", label: "לקוחות", icon: "👤" }] : []),
    ] },
    { title: "נכסים", items: [
      ...(role !== "none" ? [{ href: "/apartments", label: "דירות", icon: "🏘️" }] : []),
      ...(admin ? [{ href: "/owners", label: "בעלי דירות", icon: "🔑" }] : []),
    ] },
    { title: "ניהול", items: [
      ...(admin ? [{ href: "/reports", label: "דוחות", icon: "📊" }, { href: "/users", label: "משתמשים", icon: "👥" }, { href: "/settings", label: "הגדרות", icon: "⚙️" }] : []),
      ...(staff ? [{ href: "/old/", label: "המערכת הישנה", icon: "↩️", external: true }] : []),
    ] },
  ];
  return groups.filter((g) => g.items.length > 0);
}

export function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/");
}
