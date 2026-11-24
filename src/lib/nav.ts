import type { Role } from "@/lib/auth";

export type NavItem = { href: string; label: string; icon: string; external?: boolean };
export type NavGroup = { title: string; items: NavItem[]; pinned?: boolean };

// תפריט הצד: למעלה הדברים החשובים תמיד גלויים (pinned), והשאר מקובץ בכותרות מתכווצות.
// מסונן לפי תפקיד.
export function navGroups(role: Role): NavGroup[] {
  const staff = role === "admin" || role === "agent";
  const admin = role === "admin";
  const member = ["admin", "agent", "owner"].includes(role);
  const groups: NavGroup[] = [
    { title: "ראשי", pinned: true, items: [
      { href: "/", label: "בית", icon: "🏠" },
      ...(staff ? [{ href: "/search", label: "הזמנה חדשה", icon: "➕" }] : []),
      ...(member ? [{ href: "/bookings", label: "הזמנות", icon: "📅" }] : []),
      ...(staff ? [{ href: "/requests", label: "בקשות מהאתר", icon: "📥" }, { href: "/alerts", label: "התראות", icon: "🔔" }, { href: "/calls", label: "תיעוד שיחות", icon: "📞" }] : []),
      ...(role === "owner" ? [{ href: "/my-report", label: "הדוח שלי", icon: "📄" }] : []),
    ] },
    { title: "לקוחות ונכסים", items: [
      ...(staff ? [{ href: "/customers", label: "לקוחות", icon: "👤" }, { href: "/waitlist", label: "רשימת המתנה", icon: "⏳" }] : []),
      ...(member ? [{ href: "/apartments", label: "דירות", icon: "🏘️" }] : []),
      ...(admin ? [{ href: "/owners", label: "בעלי דירות", icon: "🔑" }] : []),
    ] },
    { title: "תחזיות ודוחות", items: [
      ...(staff ? [{ href: "/forecast", label: "תחזית שבתות", icon: "📈" }, { href: "/occupancy", label: "תפוסה חודשית", icon: "🗓️" }] : []),
      ...(admin ? [{ href: "/reports", label: "דוחות", icon: "📊" }] : []),
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
      ...(admin ? [{ href: "/users", label: "משתמשים", icon: "👥" }, { href: "/backup", label: "גיבוי וייצוא", icon: "💾" }, { href: "/settings", label: "הגדרות", icon: "⚙️" }] : []),
      ...(staff ? [{ href: "/old/", label: "המערכת הישנה", icon: "↩️", external: true }] : []),
    ] },
  ];
  return groups.filter((g) => g.items.length > 0);
}

export function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/");
}
