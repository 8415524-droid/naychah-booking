-- 014: בעל דירה רואה שם וטלפון של הלקוח בהזמנות סגורות בדירות שלו בלבד. תוספת בלבד, בטוח להרצה חוזרת.
create or replace function owner_booking_contacts()
returns table (booking_id uuid, full_name text, phone text)
language sql stable security definer set search_path = public as $$
  select b.id, c.full_name, c.phone
  from bookings b
  join customers c on c.id = b.customer_id
  join apartments a on a.id = b.apartment_id
  where b.status = 'confirmed' and my_role() = 'owner' and a.owner_id = my_owner_id()
$$;
revoke all on function owner_booking_contacts from public, anon;
grant execute on function owner_booking_contacts to authenticated;
