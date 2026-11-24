import { getSession } from "@/lib/auth";
import Shell from "@/components/Shell";

const TABLES: [string, string][] = [
  ["bookings", "הזמנות"], ["customers", "לקוחות"], ["payments", "תשלומים וקבלות"], ["apartments", "דירות"],
  ["owners", "בעלי דירות"], ["pricing_rules", "מחירון"], ["blocks", "חסימות יומן"], ["call_log", "תיעוד שיחות"],
];

export default async function Backup() {
  const { role, name } = await getSession(["admin"]);
  return (
    <Shell role={role} name={name}>
      <h1>גיבוי וייצוא</h1>
      <div className="card">
        <p className="muted">כל קובץ נפתח באקסל. מומלץ להוריד את כולם אחת לשבוע ולשמור בדרייב. הנתונים עצמם נשמרים גם ב-Supabase.</p>
        <table>
          <tbody>{TABLES.map(([t, he]) => (
            <tr key={t}><td>{he}</td><td><a className="btn" href={`/api/export/${t}`} download>הורדה (CSV)</a></td></tr>
          ))}</tbody>
        </table>
      </div>
    </Shell>
  );
}
