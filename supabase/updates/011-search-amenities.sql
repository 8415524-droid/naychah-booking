-- מאפייני חיפוש מורחבים לדירה (מנוע החיפוש החכם). תוספת בלבד, בטוח להרצה חוזרת.
-- amenities: מפתחות יציבים של מאפיינים (balcony, ac, safe_room...), הרשימה המלאה ב-src/lib/search-engine.ts
alter table apartments add column if not exists amenities text[] not null default '{}';
alter table apartments add column if not exists sofa_beds int check (sofa_beds is null or sofa_beds >= 0);
alter table apartments add column if not exists cribs int check (cribs is null or cribs >= 0);
alter table apartments add column if not exists parking_spots int check (parking_spots is null or parking_spots >= 0);
