-- שלב 5: הודעות לבעלי דירות (צינתוק והקראה במרכזייה). בטוח להרצה חוזרת.
create table if not exists owner_notifications (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references owners(id) on delete cascade,
  apartment_id uuid not null references apartments(id) on delete cascade,
  booking_id uuid references bookings(id) on delete set null,
  kind text not null default 'booked' check (kind in ('booked','cancelled')),
  check_in date not null,
  check_out date not null,
  tzintuk_attempts int not null default 0,
  tzintuk_last_at timestamptz,
  delivered_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists owner_notifications_pending on owner_notifications(owner_id) where delivered_at is null;
alter table owner_notifications enable row level security;
drop policy if exists on_staff on owner_notifications;
create policy on_staff on owner_notifications for select using (my_role() in ('admin','agent'));

-- כשהזמנה נסגרת (או מתבטלת אחרי שנסגרה), בעל דירה בלי יומן מסונכרן מקבל הודעה.
create or replace function notify_owner_on_booking() returns trigger
language plpgsql security definer set search_path = public as $$
declare o uuid; synced boolean;
begin
  select a.owner_id, w.calendar_synced into o, synced
  from apartments a join owners w on w.id = a.owner_id where a.id = new.apartment_id;
  if o is null or synced then return new; end if;
  if new.status = 'confirmed' and (tg_op = 'INSERT' or old.status is distinct from 'confirmed') then
    insert into owner_notifications(owner_id, apartment_id, booking_id, kind, check_in, check_out)
    values (o, new.apartment_id, new.id, 'booked', new.check_in, new.check_out);
  elsif tg_op = 'UPDATE' and old.status = 'confirmed' and new.status = 'cancelled' then
    insert into owner_notifications(owner_id, apartment_id, booking_id, kind, check_in, check_out)
    values (o, new.apartment_id, new.id, 'cancelled', new.check_in, new.check_out);
  end if;
  return new;
end $$;
drop trigger if exists bookings_notify_owner on bookings;
create trigger bookings_notify_owner after insert or update of status on bookings
  for each row execute function notify_owner_on_booking();

insert into settings(key, value) values
  ('secretary_phone', '""'::jsonb), ('service_phone', '""'::jsonb),
  ('queue_router_id', '""'::jsonb), ('music_url', '""'::jsonb)
on conflict (key) do nothing;
