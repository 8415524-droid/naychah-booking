# נייחא — מערכת הזמנות דירות במירון

מערכת פנימית (סגורה לקהל) לטלפניות ולבעלי דירות. Next.js + Supabase.

## הקמה
1. **מסד נתונים:** Supabase → SQL Editor → הדבק את `supabase/schema.sql` → Run. בטוח להרצה חוזרת.
2. **משתמשים:** Supabase → Authentication → Providers → Email: כבה "Allow new users to sign up". הוסף משתמשים ידנית (Add user). **המשתמש הראשון שייווצר הוא המנהל.** את שאר התפקידים מקצים בטבלה `profiles` (עמודה `role`: admin / agent / owner; לבעל דירה גם `owner_id`).
3. **Vercel:** ייבוא הריפו, ענף `main` בלבד. משתני סביבה לפי `.env.example`.

## פיתוח
```
cp .env.example .env.local
npm install && npm run dev
```
