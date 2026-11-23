-- שלוחה 4: הודעות קוליות שהלקוחות משאירים בקו. בטוח להרצה חוזרת.
create table if not exists voice_messages (
  id uuid primary key default gen_random_uuid(),
  phone text not null default '',
  file_id text not null default '',
  file_name text not null default '',
  seconds int not null default 0,
  handled boolean not null default false,
  created_at timestamptz not null default now()
);
alter table voice_messages enable row level security;
drop policy if exists vm_staff on voice_messages;
create policy vm_staff on voice_messages for select using (my_role() in ('admin','agent'));
grant all on voice_messages to service_role;
