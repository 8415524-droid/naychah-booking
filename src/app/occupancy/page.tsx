import Link from "next/link";
import { getSession } from "@/lib/auth";
import Shell from "@/components/Shell";
import { addDays, nowInJerusalem } from "@/lib/pricing";
import { monthRange } from "@/lib/reports";

const COLORS: Record<string, string> = { confirmed: "#1e2d52", hold: "#3a2650", blocked: "#4a1d24", free: "#183226" };

export default async function Occupancy({ searchParams }: { searchParams: Promise<{ m?: string }> }) {
  const sp = await searchParams;
  const { supabase, role, name } = await getSession(["admin", "agent"]);
  const month = /^\d{4}-\d{2}$/.test(sp.m ?? "") ? sp.m! : nowInJerusalem().slice(0, 7);
  const { from, to } = monthRange(month);
  const days: string[] = [];
  for (let d = from; d < to; d = addDays(d, 1)) days.push(d);
  const [{ data: apts }, { data: bookings }, { data: blocks }] = await Promise.all([
    supabase.from("apartments").select("id, name").eq("active", true).order("name"),
    supabase.from("bookings").select("apartment_id, check_in, check_out, status").in("status", ["hold", "confirmed"]).lt("check_in", to).gt("check_out", from),
    supabase.from("blocks").select("apartment_id, date_from, date_to").lt("date_from", to).gt("date_to", from),
  ]);
  const state = (aptId: string, d: string) => {
    const b = (bookings ?? []).find((x) => x.apartment_id === aptId && x.check_in <= d && x.check_out > d);
    if (b) return b.status as string;
    if ((blocks ?? []).some((k) => k.apartment_id === aptId && k.date_from <= d && k.date_to > d)) return "blocked";
    return "free";
  };
  const prev = (() => { const [y, m] = month.split("-").map(Number); return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`; })();
  const next = (() => { const [y, m] = month.split("-").map(Number); return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`; })();
  const rows = (apts ?? []).map((a) => {
    const cells = days.map((d) => state(a.id, d));
    return { a, cells, occ: cells.filter((c) => c === "confirmed" || c === "hold").length };
  });
  const totalOcc = rows.reduce((s, r) => s + r.occ, 0);
  const pct = rows.length ? Math.round((totalOcc / (rows.length * days.length)) * 100) : 0;
  return (
    <Shell role={role} name={name}>
      <h1>תפוסה חודשית</h1>
      <div className="card row">
        <span><Link href={`/occupancy?m=${prev}`}>◀ {prev}</Link></span>
        <strong>{month} · תפוסה כוללת {pct}%</strong>
        <span><Link href={`/occupancy?m=${next}`}>{next} ▶</Link></span>
      </div>
      <div className="card" style={{ overflowX: "auto" }}>
        <p className="muted">
          <span style={{ background: COLORS.confirmed, padding: "0 8px", borderRadius: 4 }}>סגורה</span>{" "}
          <span style={{ background: COLORS.hold, padding: "0 8px", borderRadius: 4 }}>ממתינה למקדמה</span>{" "}
          <span style={{ background: COLORS.blocked, padding: "0 8px", borderRadius: 4 }}>חסומה</span>{" "}
          <span style={{ background: COLORS.free, padding: "0 8px", borderRadius: 4 }}>פנויה</span>
        </p>
        <table style={{ minWidth: 900 }}>
          <thead><tr><th>דירה</th>{days.map((d) => <th key={d} style={{ padding: "4px 1px", textAlign: "center" }}>{Number(d.slice(8))}</th>)}<th>לילות</th></tr></thead>
          <tbody>{rows.map(({ a, cells, occ }) => (
            <tr key={a.id}>
              <td><Link href={`/apartments/${a.id}/calendar?m=${month}`}>{a.name}</Link></td>
              {cells.map((c, i) => <td key={i} title={`${days[i]}`} style={{ background: COLORS[c], padding: 0, minWidth: 14, borderInline: "1px solid var(--bg)" }} />)}
              <td>{occ}</td>
            </tr>
          ))}</tbody>
        </table>
      </div>
    </Shell>
  );
}
