// כרטיס מתכווץ: מכווץ בברירת מחדל, והנתונים המרכזיים מוצגים בכותרת (כמו באתר הדירות).
export default function Collapsible({ title, summary, children, className = "" }: {
  title: React.ReactNode; summary?: React.ReactNode; children: React.ReactNode; className?: string;
}) {
  return (
    <details className={`card coll ${className}`}>
      <summary>
        <span className="coll-title">{title}</span>
        {summary != null && <span className="coll-sum">{summary}</span>}
      </summary>
      <div className="coll-body">{children}</div>
    </details>
  );
}
