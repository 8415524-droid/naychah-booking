-- מיקום דירה על המפה וזמן הליכה מהציון (מחושב דרך OpenStreetMap). בטוח להרצה חוזרת.
alter table apartments add column if not exists lat double precision check (lat is null or (lat between -90 and 90));
alter table apartments add column if not exists lng double precision check (lng is null or (lng between -180 and 180));
alter table apartments add column if not exists walk_minutes int check (walk_minutes is null or walk_minutes >= 0);
alter table apartments add column if not exists walk_meters int check (walk_meters is null or walk_meters >= 0);
alter table apartments add column if not exists located_at timestamptz;
