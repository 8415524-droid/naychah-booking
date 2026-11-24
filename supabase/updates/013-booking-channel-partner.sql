-- 013: סימון ערוץ הגעה בהזמנה (RPC, כי אין עדכון ישיר על bookings) + קריאה לתפקיד שותף. תוספות בלבד, בטוח להרצה חוזרת.
create or replace function set_booking_channel(p_booking uuid, p_channel text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if my_role() not in ('admin','agent') then raise exception 'אין הרשאה'; end if;
  update bookings set marketing_channel = nullif(left(trim(p_channel), 60), '') where id = p_booking;
end $$;
revoke all on function set_booking_channel from public, anon;
grant execute on function set_booking_channel to authenticated;

-- שותף: קריאה בלבד לדוחות כספיים והזמנות
do $$ declare t text; begin
  foreach t in array array['bookings','apartments','owners','expenses','employees','payroll','apartment_bills','maintenance_tasks','cleanings','ad_spend','commission_invoices'] loop
    execute format('drop policy if exists %I on %I', t||'_partner_read', t);
    execute format('create policy %I on %I for select using (my_role() = ''partner'')', t||'_partner_read', t);
  end loop;
end $$;
