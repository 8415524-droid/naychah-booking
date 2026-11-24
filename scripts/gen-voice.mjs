// מייצר קריינות אנושית בעזרת Gemini TTS וממיר לפורמט טלפוני. הרצה: GEMINI_API_KEY=... node scripts/gen-voice.mjs
import { execFileSync } from "node:child_process";
import { writeFileSync, mkdirSync } from "node:fs";

const KEYS = [process.env.GEMINI_API_KEY, process.env.GEMINI_API_KEY_2, process.env.GEMINI_API_KEY_3, process.env.GEMINI_API_KEY_4].slice(Number(process.env.SKIP_KEYS) || 0).filter(Boolean); // שני מפתחות מחלקים את העומס על מגבלת הקצב
if (!KEYS.length) throw new Error("חסר GEMINI_API_KEY");
let keyIdx = 0;
const VOICE = process.env.VOICE || "Algenib";
const STYLE = "קרא בעברית רגילה וברורה, בלי הטעמה במלעיל, בקול גברי מבוגר, מעט צרוד וחם. הנימה: מלהיבה ושיווקית מאוד, כמו מוכר כריזמטי בשוק שמזמין לקוחות בהתלהבות ובחיוך רחב, אבל תמיד בצורה מכובדת ומכבדת. קצב מהיר, זורם ואנרגטי, קריאה רציפה בלי עצירות ובלי קטיעות באמצע מילים. את הצירוף 'ברוכים הבאים לנַיְיחָא' קרא ברצף אחד חלק בלי שום הפסקה לפני המילה נַיְיחָא, והמילה נַיְיחָא עצמה בהדגשה נלהבת בפתח ובהטעמה במלעיל (ההברה הראשונה). את 'שבת של נחת בְּמִירוֹן' קרא בהתלהבות וסיים בנימה יורדת של סוף משפט, ואז המשך לאפשרויות בקצב אחיד וקליל. ";

import { readFileSync, existsSync } from "node:fs";
const ALL = JSON.parse(readFileSync("src/lib/pbx/clips.json", "utf8"));
// VOICES="Charon,Puck" מייצר דוגמאות להשוואה; אחרת כל ההקראות הקבועות בקול VOICE (ברירת מחדל Algenib)
const SAMPLES = (process.env.VOICES || "").split(",").filter(Boolean);
const first = ALL.find((c) => c.key === "welcome");
const jobs = SAMPLES.length
  ? SAMPLES.map((v) => ({ voice: v, name: `samples/welcome-${v}`, text: first.spoken ?? first.text }))
  : ALL.map((c) => ({ voice: VOICE, name: c.key === "welcome" ? "clips/welcome-voice" : `clips/${c.key}`, text: c.spoken ?? c.text }));
const ONLY = (process.env.ONLY || "").split(",").filter(Boolean); // ONLY=welcome מפיק רק את הקליפים הנבחרים
if (ONLY.length) for (let i = jobs.length - 1; i >= 0; i--) if (!ONLY.some((k) => jobs[i].name === `clips/${k}` || jobs[i].name === `clips/${k}-voice`)) jobs.splice(i, 1);
mkdirSync("public/audio/clips", { recursive: true });
mkdirSync("public/audio/samples", { recursive: true });
let failed = 0;
for (const { voice, name, text } of jobs) {
  keyIdx++;
  if (existsSync(`public/audio/${name}.mp3`)) continue;
  try {
  // המכסה החינמית מוגבלת בקצב: ממתינים וחוזרים על 429 עד 4 פעמים
  let res;
  for (let attempt = 0; attempt < 5; attempt++) {
    res = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent", {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": KEYS[(keyIdx + attempt) % KEYS.length] },
      body: JSON.stringify({
        contents: [{ parts: [{ text: STYLE + text }] }],
        generationConfig: {
          responseModalities: ["AUDIO"],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } },
        },
      }),
    });
    if (res.status !== 429) break;
    console.log("429, ממתין 40 שניות", voice);
    await new Promise((r) => setTimeout(r, 40000));
  }
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${(await res.text()).slice(0, 600)}`);
  const j = await res.json();
  const b64 = j.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  if (!b64) throw new Error("לא התקבל שמע");
  writeFileSync(`/tmp/${name.replace('/', '_')}.pcm`, Buffer.from(b64, "base64"));
  // PCM 16-bit mono 24kHz -> mp3 מנורמל
  execFileSync("ffmpeg", ["-y", "-f", "s16le", "-ar", "24000", "-ac", "1", "-i", `/tmp/${name.replace('/', '_')}.pcm`, "-af", "atempo=1.12,loudnorm=I=-16", "-ar", "24000", "-b:a", "96k", `public/audio/${name}.mp3`], { stdio: "inherit" });
  console.log("נוצר", name);
  } catch (e) { failed++; console.log("נכשל", name, String(e).slice(0, 200)); }
}
if (failed) console.log(`נכשלו ${failed}. להריץ שוב להשלמה.`);
