-- 010 · אצווה 2: כספים, תפעול, פרסום, בקשות מהאתר. תוספות בלבד, בטוח להרצה חוזרת.
-- נגיעה בקיים: עמודה אחת חדשה ב-bookings, והרחבת רשימת התפקידים ב-profiles.

alter table bookings add column if not exists marketing_channel text;

alter table profiles drop constraint if exists profiles_role_check;
alter table profiles add constraint profiles_role_check
  check (role in ('admin','agent','owner','partner','vendor','none'));

-- הוצאות החברה
create table if not exists expenses (
  id uuid primary key default gen_random_uuid(),
  spent_on date not null default current_date,
  category text not null,
  description text,
  amount int not null check (amount >= 0),
  includes_vat boolean not null default true,
  created_at timestamptz not null default now()
);

-- עובדים ומשכורות
create table if not exists employees (
  id uuid primary key default gen_random_uuid(),
  name text not null, role_title text,
  pay_kind text not null default 'monthly' check (pay_kind in ('monthly','hourly')),
  rate int not null default 0, active boolean not null default true,
  created_at timestamptz not null default now()
);
create table if not exists payroll (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references employees(id) on delete cascade,
  month text not null check (month ~ '^\d{4}-\d{2}$'),
  hours numeric not null default 0, bonus int not null default 0,
  paid boolean not null default false,
  unique (employee_id, month)
);

-- חשבונות נכס (חשמל, מים, ארנונה)
create table if not exists apartment_bills (
  id uuid primary key default gen_random_uuid(),
  apartment_id uuid not null references apartments(id) on delete cascade,
  bill_type text not null, period text not null,
  amount int not null check (amount >= 0), due_on date,
  paid_by text not null default 'company' check (paid_by in ('company','owner')),
  charge_owner boolean not null default false, paid boolean not null default false,
  created_at timestamptz not null default now()
);

-- תחזוקה וניקיון
create table if not exists maintenance_tasks (
  id uuid primary key default gen_random_uuid(),
  apartment_id uuid not null references apartments(id) on delete cascade,
  title text not null,
  priority text not null default 'normal' check (priority in ('low','normal','high')),
  status text not null default 'open' check (status in ('open','doing','done')),
  due_on date, est_cost int not null default 0, vendor text,
  charge_owner boolean not null default false,
  created_at timestamptz not null default now()
);
create table if not exists cleanings (
  booking_id uuid primary key references bookings(id) on delete cascade,
  cost int not null default 0, done_at timestamptz not null default now()
);

-- פרסום
create table if not exists ad_spend (
  id uuid primary key default gen_random_uuid(),
  channel text not null, label text, apartment_id uuid references apartments(id) on delete set null,
  cost int not null check (cost >= 0), starts_on date not null default current_date, ends_on date,
  created_at timestamptz not null default now()
);

-- חשבוניות עמלה לבעלי דירות
create sequence if not exists commission_invoice_seq start 1;
create table if not exists commission_invoices (
  id uuid primary key default gen_random_uuid(),
  number int not null unique default nextval('commission_invoice_seq'),
  owner_id uuid not null references owners(id),
  month text not null, net int not null, vat int not null, total int not null,
  lines jsonb not null default '[]',
  status text not null default 'draft' check (status in ('draft','sent','paid')),
  created_at timestamptz not null default now()
);

-- קבלות זיכוי: קבלה מקורית לא משתנה, הזיכוי הוא מסמך נפרד
create sequence if not exists credit_note_seq start 1;
create table if not exists credit_notes (
  id uuid primary key default gen_random_uuid(),
  number int not null unique default nextval('credit_note_seq'),
  payment_id uuid not null references payments(id),
  amount int not null check (amount > 0), reason text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);
create or replace function lock_credit_notes() returns trigger language plpgsql as
$$ begin raise exception 'קבלת זיכוי אינה ניתנת לשינוי או מחיקה'; end $$;
drop trigger if exists credit_notes_locked on credit_notes;
create trigger credit_notes_locked before update or delete on credit_notes
  for each row execute function lock_credit_notes();

-- הסכם לבעל דירה
create table if not exists owner_agreements (
  owner_id uuid primary key references owners(id) on delete cascade,
  id_number text, address text, email text, starts_on date, ends_on date,
  commission_pct numeric not null default 10, notice_days int not null default 30,
  signed boolean not null default false, notes text
);

-- בקשות מהאתר (טופס ציבורי)
create table if not exists booking_requests (
  id uuid primary key default gen_random_uuid(),
  full_name text not null, phone text not null, guests int,
  check_in date, check_out date, notes text,
  status text not null default 'new' check (status in ('new','handled','dismissed')),
  created_at timestamptz not null default now()
);
create or replace function submit_booking_request(
  p_name text, p_phone text, p_guests int, p_in date, p_out date, p_notes text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if length(trim(coalesce(p_name,''))) < 2 or length(regexp_replace(coalesce(p_phone,''),'\D','','g')) < 9 then
    raise exception 'פרטים חסרים';
  end if;
  insert into booking_requests(full_name, phone, guests, check_in, check_out, notes)
  values (left(trim(p_name),100), left(trim(p_phone),30), p_guests, p_in, p_out, left(p_notes,500));
end $$;
grant execute on function submit_booking_request to anon, authenticated;

-- הרשאות: מנהל בלבד לכספים; טלפנית רואה ומטפלת בבקשות; ספק רואה תחזוקה
alter table expenses enable row level security;
alter table employees enable row level security;
alter table payroll enable row level security;
alter table apartment_bills enable row level security;
alter table maintenance_tasks enable row level security;
alter table cleanings enable row level security;
alter table ad_spend enable row level security;
alter table commission_invoices enable row level security;
alter table credit_notes enable row level security;
alter table owner_agreements enable row level security;
alter table booking_requests enable row level security;

do $$ declare t text; begin
  foreach t in array array['expenses','employees','payroll','apartment_bills','ad_spend','commission_invoices','owner_agreements'] loop
    execute format('drop policy if exists %I on %I', t||'_admin', t);
    execute format('create policy %I on %I for all using (my_role() = ''admin'') with check (my_role() = ''admin'')', t||'_admin', t);
  end loop;
end $$;
drop policy if exists maint_staff on maintenance_tasks;
create policy maint_staff on maintenance_tasks for all using (my_role() in ('admin','agent','vendor')) with check (my_role() in ('admin','agent','vendor'));
drop policy if exists clean_staff on cleanings;
create policy clean_staff on cleanings for all using (my_role() in ('admin','agent','vendor')) with check (my_role() in ('admin','agent','vendor'));
drop policy if exists credit_admin on credit_notes;
create policy credit_admin on credit_notes for select using (my_role() in ('admin','agent'));
create policy credit_ins on credit_notes for insert with check (my_role() = 'admin');
drop policy if exists req_staff on booking_requests;
create policy req_staff on booking_requests for all using (my_role() in ('admin','agent')) with check (my_role() in ('admin','agent'));
