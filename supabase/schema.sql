-- נייחא — סכמת מסד נתונים מלאה (שלב 1)
-- הרצה: Supabase → SQL Editor → New query → הדבק הכול → Run.
-- בטוח להרצה חוזרת (idempotent).

create extension if not exists btree_gist;

-- ---------- משתמשים והרשאות ----------
create table if not exists owners (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  phone2 text,
  calendar_synced boolean not null default false,
  callback_phone text,            -- טלפון לצינתוק
  pin text,                       -- קוד למרכזייה
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'none' check (role in ('admin','agent','owner','none')),
  full_name text,
  owner_id uuid references owners(id) on delete set null,
  created_at timestamptz not null default now()
);

create or replace function my_role() returns text
language sql stable security definer set search_path = public as
$$ select coalesce((select role from profiles where id = auth.uid()), 'none') $$;

create or replace function my_owner_id() returns uuid
language sql stable security definer set search_path = public as
$$ select owner_id from profiles where id = auth.uid() $$;

-- המשתמש הראשון שנרשם הוא מנהל; כל השאר ללא הרשאה עד שהמנהל מקצה תפקיד.
create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles(id, role, full_name)
  values (new.id,
          case when exists (select 1 from profiles) then 'none' else 'admin' end,
          coalesce(new.raw_user_meta_data->>'full_name', new.email));
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function handle_new_user();

-- ---------- דירות ----------
create table if not exists apartments (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references owners(id) on delete restrict,
  short_code int unique,              -- מספר דירה למרכזייה
  name text not null,
  address text,
  beds int not null check (beds > 0),
  rooms int,
  features text[] not null default '{}',   -- מזגן, מרפסת, נגישות...
  distance_from_tomb_m int,
  onsite_contact text,
  notes text,
  photos text[] not null default '{}',
  -- חוקי זמן, כל בעל דירה קובע לעצמו וניתן לשינוי בכל עת
  early_cutoff_dow smallint not null default 4 check (early_cutoff_dow between 0 and 6), -- 4 = חמישי
  early_cutoff_time time not null default '12:00',
  single_night_opens_dow smallint not null default 4,
  single_night_opens_time time not null default '18:00',
  active boolean not null default true,
  ical_import_url text,
  ical_token uuid not null default gen_random_uuid(),
  created_at timestamptz not null default now()
);

-- סוגי תקופה: thu_sat (חמישי-שבת), fri_sat (שישי-שבת), single_night, midweek, special
create table if not exists pricing_rules (
  id uuid primary key default gen_random_uuid(),
  apartment_id uuid not null references apartments(id) on delete cascade,
  period_type text not null check (period_type in ('thu_sat','fri_sat','single_night','midweek','special')),
  label text,
  valid_from date,                    -- לתקופה מיוחדת (חג, ל"ג בעומר)
  valid_to date,
  price_early int not null check (price_early >= 0),  -- נסגר עד שעת הסף (חמישי בשעה X)
  price_late int not null check (price_late >= 0),    -- נסגר אחרי שעת הסף (יום שישי)
  created_at timestamptz not null default now()
);
create index if not exists pricing_rules_apt on pricing_rules(apartment_id);

-- ---------- לקוחות והזמנות ----------
create table if not exists customers (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  phone text not null unique,
  notes text,
  created_at timestamptz not null default now()
);

-- hold = תפוסה זמנית (ממתין למקדמה, עם טיימר), confirmed = סגורה, cancelled, expired
create table if not exists bookings (
  id uuid primary key default gen_random_uuid(),
  apartment_id uuid not null references apartments(id),
  customer_id uuid not null references customers(id),
  check_in date not null,
  check_out date not null check (check_out > check_in),
  guests int,
  total_price int not null check (total_price >= 0),
  deposit_required int not null,
  status text not null default 'hold' check (status in ('hold','confirmed','cancelled','expired')),
  hold_expires_at timestamptz,
  source text not null default 'agent' check (source in ('agent','owner','phone')),
  created_by uuid references auth.users(id),
  notes text,
  created_at timestamptz not null default now(),
  constraint bookings_no_overlap exclude using gist (
    apartment_id with =, daterange(check_in, check_out) with &&
  ) where (status in ('hold','confirmed'))
);
create index if not exists bookings_apt on bookings(apartment_id, check_in);
create index if not exists bookings_customer on bookings(customer_id);

-- חסימות יומן: סגירה ע"י בעל הדירה, סגירה שלו בטלפון, יבוא iCal
create table if not exists blocks (
  id uuid primary key default gen_random_uuid(),
  apartment_id uuid not null references apartments(id) on delete cascade,
  date_from date not null,
  date_to date not null check (date_to > date_from),   -- אקסקלוסיבי, כמו check_out
  source text not null default 'owner_web' check (source in ('owner_web','owner_phone','ical','admin')),
  note text,
  created_at timestamptz not null default now(),
  constraint blocks_no_overlap exclude using gist (
    apartment_id with =, daterange(date_from, date_to) with &&
  )
);

-- מונע חפיפה בין חסימה להזמנה פעילה
create or replace function check_block_vs_booking() returns trigger
language plpgsql as $$
begin
  if tg_table_name = 'blocks' then
    if exists (select 1 from bookings b where b.apartment_id = new.apartment_id
               and b.status in ('hold','confirmed')
               and daterange(b.check_in, b.check_out) && daterange(new.date_from, new.date_to)) then
      raise exception 'התאריכים תפוסים בהזמנה' using errcode = '23P01';
    end if;
  else
    if new.status in ('hold','confirmed') and exists (
         select 1 from blocks k where k.apartment_id = new.apartment_id
         and daterange(k.date_from, k.date_to) && daterange(new.check_in, new.check_out)) then
      raise exception 'התאריכים חסומים ביומן' using errcode = '23P01';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists blocks_vs_bookings on blocks;
create trigger blocks_vs_bookings before insert or update on blocks
  for each row execute function check_block_vs_booking();
drop trigger if exists bookings_vs_blocks on bookings;
create trigger bookings_vs_blocks before insert or update on bookings
  for each row execute function check_block_vs_booking();

-- ---------- תשלומים וקבלות ----------
create sequence if not exists receipt_seq start 1001;
create table if not exists payments (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references bookings(id),
  amount int not null check (amount > 0),
  method text not null check (method in ('credit','transfer','cash','other')),
  reference text,                       -- אסמכתא. לעולם לא מספר כרטיס!
  receipt_no int not null unique default nextval('receipt_seq'),
  received_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

-- נעילת קבלות: אין עדכון ואין מחיקה
create or replace function lock_payments() returns trigger
language plpgsql as $$
begin raise exception 'קבלה אינה ניתנת לשינוי או מחיקה'; end $$;
drop trigger if exists payments_locked on payments;
create trigger payments_locked before update or delete on payments
  for each row execute function lock_payments();

-- ---------- שיחות והגדרות ----------
create table if not exists call_log (
  id uuid primary key default gen_random_uuid(),
  direction text not null check (direction in ('in','out')),
  kind text,                -- customer / owner / tzintuk
  phone text,
  customer_id uuid references customers(id),
  booking_id uuid references bookings(id),
  owner_id uuid references owners(id),
  recording_url text,
  duration_s int,
  note text,
  created_at timestamptz not null default now()
);

create table if not exists settings (
  key text primary key,
  value jsonb not null
);
insert into settings(key, value) values
  ('deposit_percent', '12'::jsonb),
  ('hold_minutes', '30'::jsonb)
on conflict (key) do nothing;

-- ---------- פעולות אטומיות ----------
create or replace function expire_holds() returns int
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  update bookings set status = 'expired'
  where status = 'hold' and hold_expires_at < now();
  get diagnostics n = row_count;
  return n;
end $$;

-- תפיסת דירה (ממתין למקדמה). אילוץ במסד מונע שתי טלפניות לתפוס אותה דירה.
create or replace function create_hold(
  p_apartment uuid, p_check_in date, p_check_out date, p_guests int,
  p_name text, p_phone text, p_total int, p_source text default 'agent')
returns uuid language plpgsql security definer set search_path = public as $$
declare cid uuid; bid uuid; pct numeric; mins int;
begin
  if my_role() not in ('admin','agent') then raise exception 'אין הרשאה'; end if;
  perform expire_holds();
  select (value#>>'{}')::numeric into pct from settings where key='deposit_percent';
  select (value#>>'{}')::int into mins from settings where key='hold_minutes';
  insert into customers(full_name, phone) values (p_name, p_phone)
  on conflict (phone) do update set full_name = excluded.full_name
  returning id into cid;
  insert into bookings(apartment_id, customer_id, check_in, check_out, guests,
                       total_price, deposit_required, hold_expires_at, source, created_by)
  values (p_apartment, cid, p_check_in, p_check_out, p_guests, p_total,
          ceil(p_total * pct / 100.0), now() + make_interval(mins => coalesce(mins,30)),
          p_source, auth.uid())
  returning id into bid;
  return bid;
end $$;

-- רישום מקדמה. כשהסכום מגיע ל-12% ההזמנה נסגרת.
create or replace function record_payment(
  p_booking uuid, p_amount int, p_method text, p_reference text default null)
returns int language plpgsql security definer set search_path = public as $$
declare b bookings; paid int; rno int;
begin
  if my_role() not in ('admin','agent') then raise exception 'אין הרשאה'; end if;
  select * into b from bookings where id = p_booking for update;
  if not found then raise exception 'הזמנה לא נמצאה'; end if;
  if b.status = 'expired' or b.status = 'cancelled' then
    raise exception 'ההזמנה פגה או בוטלה, יש לפתוח מחדש';
  end if;
  insert into payments(booking_id, amount, method, reference, received_by)
  values (p_booking, p_amount, p_method, p_reference, auth.uid())
  returning receipt_no into rno;
  select coalesce(sum(amount),0) into paid from payments where booking_id = p_booking;
  if paid >= b.deposit_required then
    update bookings set status = 'confirmed', hold_expires_at = null where id = p_booking;
  end if;
  return rno;
end $$;

create or replace function cancel_booking(p_booking uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if my_role() not in ('admin','agent') then raise exception 'אין הרשאה'; end if;
  update bookings set status = 'cancelled' where id = p_booking;
end $$;

-- שחרור אוטומטי כל דקה (אם pg_cron זמין בפרויקט)
do $$ begin
  create extension if not exists pg_cron;
  perform cron.schedule('expire-holds', '* * * * *', 'select public.expire_holds()');
exception when others then
  raise notice 'pg_cron לא זמין. הפגה מתבצעת בכל תפיסה ובכל חיפוש.';
end $$;

-- ---------- RLS ----------
alter table owners enable row level security;
alter table profiles enable row level security;
alter table apartments enable row level security;
alter table pricing_rules enable row level security;
alter table customers enable row level security;
alter table bookings enable row level security;
alter table blocks enable row level security;
alter table payments enable row level security;
alter table call_log enable row level security;
alter table settings enable row level security;

do $$ declare r record; begin
  for r in select policyname, tablename from pg_policies where schemaname='public' loop
    execute format('drop policy %I on %I', r.policyname, r.tablename);
  end loop;
end $$;

-- פרופילים
create policy profiles_self on profiles for select using (id = auth.uid() or my_role() = 'admin');
create policy profiles_admin on profiles for all using (my_role() = 'admin') with check (my_role() = 'admin');

-- בעלים
create policy owners_staff on owners for select using (my_role() in ('admin','agent'));
create policy owners_self on owners for select using (id = my_owner_id());
create policy owners_admin on owners for all using (my_role() = 'admin') with check (my_role() = 'admin');

-- דירות
create policy apts_staff on apartments for select using (my_role() in ('admin','agent'));
create policy apts_owner_read on apartments for select using (owner_id = my_owner_id());
create policy apts_owner_write on apartments for update using (owner_id = my_owner_id()) with check (owner_id = my_owner_id());
create policy apts_owner_insert on apartments for insert with check (owner_id = my_owner_id());
create policy apts_admin on apartments for all using (my_role() = 'admin') with check (my_role() = 'admin');

-- מחירים
create policy pr_staff on pricing_rules for select using (my_role() in ('admin','agent'));
create policy pr_owner on pricing_rules for all
  using (exists (select 1 from apartments a where a.id = apartment_id and a.owner_id = my_owner_id()))
  with check (exists (select 1 from apartments a where a.id = apartment_id and a.owner_id = my_owner_id()));
create policy pr_admin on pricing_rules for all using (my_role() = 'admin') with check (my_role() = 'admin');

-- לקוחות: צוות בלבד
create policy cust_staff on customers for select using (my_role() in ('admin','agent'));
create policy cust_staff_w on customers for update using (my_role() in ('admin','agent'));

-- הזמנות: צוות רואה הכול, בעל דירה רואה רק של דירותיו. כתיבה רק דרך הפונקציות.
create policy bk_staff on bookings for select using (my_role() in ('admin','agent'));
create policy bk_owner on bookings for select
  using (exists (select 1 from apartments a where a.id = apartment_id and a.owner_id = my_owner_id()));

-- חסימות
create policy blk_staff on blocks for select using (my_role() in ('admin','agent'));
create policy blk_staff_w on blocks for all using (my_role() = 'admin') with check (my_role() = 'admin');
create policy blk_owner on blocks for all
  using (exists (select 1 from apartments a where a.id = apartment_id and a.owner_id = my_owner_id()))
  with check (exists (select 1 from apartments a where a.id = apartment_id and a.owner_id = my_owner_id()));

-- תשלומים ושיחות: צוות בלבד (קריאה). כתיבה רק דרך record_payment.
create policy pay_staff on payments for select using (my_role() in ('admin','agent'));
create policy call_staff on call_log for select using (my_role() in ('admin','agent'));

-- הגדרות: כולם מחוברים קוראים, מנהל כותב
create policy set_read on settings for select using (my_role() <> 'none');
create policy set_admin on settings for all using (my_role() = 'admin') with check (my_role() = 'admin');

-- ---------- הרשאות הפעלה לפונקציות ----------
revoke all on function create_hold, record_payment, cancel_booking, expire_holds from public, anon;
grant execute on function create_hold, record_payment, cancel_booking to authenticated;
