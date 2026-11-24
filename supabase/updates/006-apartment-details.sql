-- פרטי דירה נוספים: חצר, טרמפולינה, נדנדה, יחידת הורים, גודל סלון, מצב, קומה, מקלחות ושירותים.
-- בטוח להרצה חוזרת.
alter table apartments add column if not exists has_yard boolean not null default false;
alter table apartments add column if not exists has_trampoline boolean not null default false;
alter table apartments add column if not exists has_swing boolean not null default false;
alter table apartments add column if not exists has_parents_unit boolean not null default false;
alter table apartments add column if not exists living_room_sqm int check (living_room_sqm is null or living_room_sqm > 0);
alter table apartments add column if not exists condition text check (condition is null or condition in ('new','medium','luxurious','weak','reasonable'));
alter table apartments add column if not exists floor int;           -- 0 = קרקע
alter table apartments add column if not exists showers int check (showers is null or showers >= 0);
alter table apartments add column if not exists toilets int check (toilets is null or toilets >= 0);
