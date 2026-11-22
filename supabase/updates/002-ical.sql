-- שלב 4: פיד iCal ליומן של דירה. בטוח להרצה חוזרת.
-- הפיד נגיש בלי כניסה, רק למי שמחזיק את הטוקן הסודי של הדירה.
-- חסימות שיובאו מ-iCal לא מיוצאות חזרה (מונע לולאת סנכרון).

create or replace function ical_feed(p_token uuid)
returns table(d_from date, d_to date, kind text)
language sql stable security definer set search_path = public as $$
  select b.date_from, b.date_to, 'block'::text
  from blocks b join apartments a on a.id = b.apartment_id
  where a.ical_token = p_token and b.source <> 'ical'
  union all
  select k.check_in, k.check_out, 'booking'::text
  from bookings k join apartments a on a.id = k.apartment_id
  where a.ical_token = p_token and (k.status = 'confirmed' or (k.status = 'hold' and k.hold_expires_at > now()))
$$;

revoke all on function ical_feed(uuid) from public;
grant execute on function ical_feed(uuid) to anon, authenticated;
