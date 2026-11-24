// בורר חודש (GET). allowAll מוסיף אפשרות "כל התקופות".
export default function MonthForm({ month, allowAll = false }: { month: string; allowAll?: boolean }) {
  return (
    <form className="card row" method="get">
      <span><label>חודש</label><input type="month" name="m" defaultValue={month === "all" ? "" : month} /></span>
      <span>
        <button className="btn">הצג</button>{" "}
        {allowAll && <button className="btn" name="m" value="all">כל התקופות</button>}
      </span>
    </form>
  );
}
