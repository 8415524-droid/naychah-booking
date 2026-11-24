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
      ...(staff ? [{ href: "/search", label: "חיפוש דירה", icon: "🔎" }, { href: "/alerts", label: "התראות", icon: "🔔" }] : []),
      ...(role === "owner" ? [{ href: "/my-report", label: "הדוח שלי", icon: "📄" }] : []),
    ] },
    { title: "הזמנות", items: [
      ...(["admin", "agent", "owner"].includes(role) ? [{ href: "/bookings", label: "הזמנות", icon: "📅" }] : []),
      ...(staff ? [{ href: "/requests", label: "בקשות מהאתר", icon: "📥" }] : []),
      ...(staff ? [{ href: "/customers", label: "לקוחות", icon: "👤" }, { href: "/calls", label: "תיעוד שיחות", icon: "📞" }] : []),
      ...(staff ? [{ href: "/forecast", label: "תחזית שבתות", icon: "📈" }, { href: "/occupancy", label: "תפוסה חודשית", icon: "🗓️" }] : []),
    ] },
    { title: "נכסים", items: [
      ...(["admin", "agent", "owner"].includes(role) ? [{ href: "/apartments", label: "דירות", icon: "🏘️" }] : []),
      ...(admin ? [{ href: "/owners", label: "בעלי דירות", icon: "🔑" }] : []),
    ] },
    { title: "כספים", items: [
      ...(admin ? [
        { href: "/expenses", label: "הוצאות", icon: "🧾" }, { href: "/payroll", label: "משכורות", icon: "💼" },
        { href: "/bills", label: "חשבונות נכס", icon: "💡" }, { href: "/ads", label: "פרסום", icon: "📣" },
        { href: "/invoices", label: "חשבוניות עמלה", icon: "📑" },
      ] : []),
      ...(admin || role === "partner" ? [{ href: "/pnl", label: "רווח והפסד", icon: "💰" }, { href: "/settlement", label: "התחשבנות עם בעלים", icon: "🤝" }] : []),
    ] },
    { title: "תפעול", items: [
      ...(staff || role === "vendor" ? [{ href: "/maintenance", label: "תחזוקה וניקיון", icon: "🛠️" }] : []),
    ] },
    { title: "ניהול", items: [
      ...(admin ? [{ href: "/reports", label: "דוחות", icon: "📊" }, { href: "/users", label: "משתמשים", icon: "👥" }, { href: "/backup", label: "גיבוי וייצוא", icon: "💾" }, { href: "/settings", label: "הגדרות", icon: "⚙️" }] : []),
      ...(staff ? [{ href: "/old/", label: "המערכת הישנה", icon: "↩️", external: true }] : []),
    ] },
  ];
  return groups.filter((g) => g.items.length > 0);
}

export function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/");
}
