# התקנה על שרת אישי

דרישות: שרת Linux (Ubuntu 24.04) עם IP ציבורי קבוע, ודומיין (או תת-דומיין) שמצביע אליו (רשומת A).

## דרך מהירה: סקריפט התקנה
אחרי `git clone` של הריפו (ראו למטה) מריצים `bash scripts/install.sh`. הוא מתקין Docker, שואל על הדומיין (ברירת מחדל: `<ה-IP>.sslip.io`, שעובד בלי לקנות דומיין) ועל המפתח הסודי של Supabase, מייצר את שאר הסודות, פותח חומת אש ומפעיל. בסוף הוא מדפיס את הכתובות להזנה בטכנוליין.

## 1. פעם אחת בשרת (ידנית)
```
curl -fsSL https://get.docker.com | sh
git clone https://github.com/8415524-droid/naychah-booking.git
cd naychah-booking
cp .env.example .env
nano .env
```
במילוי `.env`:
- `SUPABASE_SERVICE_ROLE_KEY`: Supabase → Project Settings → API Keys → secret key.
- `PBX_SECRET`, `TZINTUK_SECRET`: ליצור עם `openssl rand -hex 24` (פעמיים).
- `DOMAIN`: הדומיין שהפנית לשרת.

## 2. הרצה
```
docker compose up -d --build
```
האתר יעלה ב-HTTPS אוטומטית. הצינתוקים יופעלו כל דקה מאותו שרת.

## 3. עדכון גרסה
```
git pull
docker compose up -d --build
```

## 4. אחרי ההתקנה
1. לאשר בטכנוליין את כתובת ה-IP של השרת (נדרש ל-`makeCall`).
2. להזין בטכנוליין: `https://<DOMAIN>/api/pbx/main/<PBX_SECRET>` (קו לקוחות) ו-`https://<DOMAIN>/api/pbx/owner/<PBX_SECRET>` (קו בעלי דירות).
3. ב-Supabase: Authentication → URL Configuration → Site URL = `https://<DOMAIN>`.

## אבטחה
- לפתוח בחומת האש רק פורטים 22, 80, 443: `ufw allow 22,80,443/tcp` ואז `ufw enable`.
- לא להעלות `.env` ל-GitHub (מוחרג ב-.gitignore).
