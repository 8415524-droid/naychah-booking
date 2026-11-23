// מייצר קריינות אנושית בעזרת Gemini TTS וממיר לפורמט טלפוני. הרצה: GEMINI_API_KEY=... node scripts/gen-voice.mjs
import { execFileSync } from "node:child_process";
import { writeFileSync, mkdirSync } from "node:fs";

const KEY = process.env.GEMINI_API_KEY;
if (!KEY) throw new Error("חסר GEMINI_API_KEY");
const VOICE = process.env.VOICE || "Kore";
const STYLE = "קרא בעברית בקול חם, שמח ומזמין, בטון שיווקי ואנושי, בקצב נעים עם הדגשות, כמו קריין בחברת נופש ברמה גבוהה. ";

const CLIPS = {
  welcome:
    "ברוכים הבאים לניחא! הכתובת שלכם לשבתות בלתי נשכחות במירון. דירות נבחרות, אווירה של קדושה ושמחה, ושבת של נחת בדיוק כמו שחלמתם. להזמנת דירה, הקישו אחת. לבירורים על הזמנה קיימת, הקישו שתיים. לשירות לקוחות, הקישו שלוש.",
};

mkdirSync("public/audio", { recursive: true });
for (const [name, text] of Object.entries(CLIPS)) {
  const res = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent", {
    method: "POST",
    headers: { "content-type": "application/json", "x-goog-api-key": KEY },
    body: JSON.stringify({
      contents: [{ parts: [{ text: STYLE + text }] }],
      generationConfig: {
        responseModalities: ["AUDIO"],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: VOICE } } },
      },
    }),
  });
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const j = await res.json();
  const b64 = j.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  if (!b64) throw new Error("לא התקבל שמע");
  writeFileSync(`/tmp/${name}.pcm`, Buffer.from(b64, "base64"));
  // PCM 16-bit mono 24kHz -> mp3 מנורמל
  execFileSync("ffmpeg", ["-y", "-f", "s16le", "-ar", "24000", "-ac", "1", "-i", `/tmp/${name}.pcm`, "-af", "loudnorm=I=-16", "-ar", "22050", "-b:a", "64k", `public/audio/${name}.mp3`], { stdio: "inherit" });
  console.log("נוצר", name);
}
