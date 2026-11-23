-- תור המתנה בקו הלקוחות: מי ממתין ומאז מתי (למספר "הנך מספר X"). בטוח להרצה חוזרת.
create table if not exists queue_waiting (
  call_id text primary key,
  kind text not null default 'booking',
  joined_at timestamptz not null default now(),
  last_seen timestamptz not null default now()
);
alter table queue_waiting enable row level security;
grant all on queue_waiting to service_role;
