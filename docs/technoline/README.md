# עבודה עם טכנוליין (מרכזיה) — מדריך לכל סשן

קרא קודם את `PBX_DOCUMENTATION_CENTER.md` (המדריך הרשמי של טכנוליין ל-AI, באנגלית). הפירוט המלא:
`module-api-reference.txt` (מודל ה-API, מתוך app.tlivr.com/apiModuleDocs.html) ו-`extensions-api-reference.txt`
(ניהול שלוחות, מתוך ivrExtensionsApiDocs.html). המקורות החיים: app.tlivr.com/pbxDocsCenter.html ו-`/PBX_DOCUMENTATION_CENTER.md`.

## שני ערוצים שונים לגמרי
1. **Module API** — המרכזיה קוראת (GET) לכתובת שלנו בכל שלב בשיחה, ואנחנו מחזירים JSON עם מודול אחד (או מערך).
   אין apiKey; הכתובת היא המזהה. אצלנו: `/api/pbx/main/<PBX_SECRET>` ו-`/api/pbx/owner/<PBX_SECRET>`.
2. **Interaction API** — אנחנו קוראים ל-`api.tlivr.com/ivrFilesApi.php?action=...` עם `apiKey` (ניהול שלוחות, העלאת קבצים,
   מוזיקה בהמתנה). אין לנו apiKey; לא מבקשים אותו מהמשתמש בצ'אט. פעולות כאלה נעשות בפורטל app.tlivr.com בדפדפן.

## כללים שנלמדו בדם
- JSON לא תקין או `type` לא מוכר = המרכזיה חוזרת בשקט לתפריט הקודם (נשמע כ"התפריט חוזר על עצמו").
- `files` יכול להכיל: `{text}` (הקראה ממוכנת), `{name}`/`{fileId}` (קובץ בספריית החשבון), `{number}`, `{digits}`,
  `{fileLink, fileName}`. **קובץ חיצוני (`fileLink`) חייב `fileName`** — זה מפתח המטמון (נשמר ימים; שינוי תוכן = שינוי fileName).
  בלי fileName ההקראה לא מושמעת. אצלנו `fileName = <מפתח>_v2` (להעלות גרסה כשמחליפים קובץ).
- **כתובת קובץ חיצוני חייבת להיות ציבורית** (בלי התחברות). ב-`src/proxy.ts` נתיב `/audio/` פטור מהתחברות — אחרת 307 ל-/login ושקט בקו.
- הקראה ממוכנת: ברירת מחדל Google (חינם). קולות Gemini (`"voice":"Algenib"`) בתשלום לפי שימוש.
- `simpleMenu.enabledKeys` מופרד בפסיקים ("1,2,3"). תוצאת התפריט מגיעה בשם המודול. פרמטרים מצטברים (`paramsMode=chain`).
- `record` מחזיר `FILEID_<name>`, `FILE_<name>`, `DURATION_<name>`; `sttSoft:true` מוסיף תמלול ברקע ב-`TEXT_<name>`.
- `queueRouting` עם `continueOnFail:"yes"` מחזיר `<name>=NOAGENTS/NOANSWER/ERROR` ו-`STEXT_<name>` ושולט בהמשך. אפשר נתב מוגדר (`routerId`) או בלוק `router`+`phones` בזמן שיחה.
- `systemMessages` מחליף הודעות מערכת (קודי S...) לכל המשך השיחה.
- חיוג החוצה לנציגים עולה (~0.13 ₪ לדקה). חבילה פעילה נדרשת (באנר "לפני 29/11").
- הגדרות בפורטל: "מוזיקה בהמתנה" (IP_MUSIC_1..3, "העלאת מוזיקה"), נתבי שיחות, ניהול שלוחות. הדפדפן של Claude אינו יכול לבחור קובץ מקומי,
  ואתר הפורטל חוסם fetch/iframe לכתובות זרות — העלאת קבצים לפורטל נעשית ידנית על ידי המשתמש.
- סיסמת מערכת הטכנוליין נשמרת בהגדרות המערכת מוצפנת (החלפה בלבד).

## אצלנו בקוד
`src/lib/pbx/` — `types.ts` (מודולים + `pbxFiles`), `main-flow.ts` (קו לקוחות), `queue.ts` (תור המתנה משלנו), `clips.json` + `scripts/gen-voice.mjs`
(הקראות מוקלטות בקול Algenib דרך workflow `generate-voice`), בדיקות `flows.test.ts`.
