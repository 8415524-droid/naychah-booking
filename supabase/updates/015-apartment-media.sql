-- 015: גלריית תמונות וסרטונים לדירה. תוספת בלבד, בטוח להרצה חוזרת.
create table if not exists apartment_media (
  id uuid primary key default gen_random_uuid(),
  apartment_id uuid not null references apartments(id) on delete cascade,
  path text not null unique,
  kind text not null check (kind in ('image','video')),
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);
create index if not exists apartment_media_apt on apartment_media(apartment_id, created_at);
alter table apartment_media enable row level security;
drop policy if exists media_read on apartment_media;
create policy media_read on apartment_media for select using (
  my_role() in ('admin','agent','partner')
  or (my_role() = 'owner' and exists (select 1 from apartments a where a.id = apartment_id and a.owner_id = my_owner_id())));
drop policy if exists media_write on apartment_media;
create policy media_write on apartment_media for insert with check (
  my_role() = 'admin'
  or (my_role() = 'owner' and exists (select 1 from apartments a where a.id = apartment_id and a.owner_id = my_owner_id())));
drop policy if exists media_delete on apartment_media;
create policy media_delete on apartment_media for delete using (
  my_role() = 'admin'
  or (my_role() = 'owner' and exists (select 1 from apartments a where a.id = apartment_id and a.owner_id = my_owner_id())));
grant all on apartment_media to authenticated, service_role;

-- מאגר הקבצים: ציבורי לקריאה (הקישורים אקראיים), כתיבה רק דרך השרת. עד 50MB לקובץ.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('apartment-media', 'apartment-media', true, 52428800,
  array['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/quicktime','video/webm'])
on conflict (id) do nothing;
