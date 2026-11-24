-- רשימת המתנה לחיפוש: בקשה שלא נמצאה לה דירה נשמרת, והמערכת בודקת בכל כניסה אם התפנתה דירה מתאימה.
-- תוספת בלבד, בטוח להרצה חוזרת.
create table if not exists search_waitlist (
  id uuid primary key default gen_random_uuid(),
  customer_name text not null,
  customer_phone text not null,
  params text not null,                 -- מחרוזת החיפוש המלאה (כל הדרישות), כדי להריץ אותה שוב
  check_in date not null,
  check_out date not null check (check_out > check_in),
  guests int,
  status text not null default 'open' check (status in ('open','closed')),
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);
create index if not exists search_waitlist_open on search_waitlist(status, check_in);
alter table search_waitlist enable row level security;
drop policy if exists waitlist_staff on search_waitlist;
create policy waitlist_staff on search_waitlist for all
  using (my_role() in ('admin','agent')) with check (my_role() in ('admin','agent'));
