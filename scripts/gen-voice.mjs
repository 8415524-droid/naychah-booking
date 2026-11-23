// מייצר קריינות אנושית בעזרת Gemini TTS וממיר לפורמט טלפוני. הרצה: GEMINI_API_KEY=... node scripts/gen-voice.mjs
import { execFileSync } from "node:child_process";
import { writeFileSync, mkdirSync } from "node:fs";

const KEY = process.env.GEMINI_API_KEY;
if (!KEY) throw new Error("חסר GEMINI_API_KEY");
const VOICE = process.env.VOICE || "Charon";
const STYLE = "קרא בעברית בקול גברי חם, שמח ומזמין, בטון שיווקי ואנושי, בקצב נעים עם הדגשות, כמו קריין בחברת נופש ברמה גבוהה. ";

const CLIPS = {
  welcome:
    "נַיְיחָא! שבת של נחת בְּמִירוֹן. להזמנת דירה, הקישו אחת. לבירורים על הזמנה, הקישו שתיים. לשירות, הקישו שלוש. להשארת הודעה, הקישו ארבע.",
  queue:
    "כל הנציגים שלנו עסוקים כרגע בשיחה אחרת. אנא המתינו על הקו, ונשיב לכם בהקדם. תודה על הסבלנות!",
};

// VOICES="Charon,Puck" מייצר דוגמאות להשוואה ב-public/audio/samples
const SAMPLES = (process.env.VOICES || "").split(",").filter(Boolean);
const jobs = SAMPLES.length
  ? [
      ...SAMPLES.map((v) => ({ voice: v, name: `samples/welcome-${v}`, text: CLIPS.welcome })),
      { voice: SAMPLES[0], name: `samples/queue-${SAMPLES[0]}`, text: CLIPS.queue },
    ]
  : Object.entries(CLIPS).map(([name, text]) => ({ voice: VOICE, name, text }));
mkdirSync("public/audio/samples", { recursive: true });
for (const { voice, name, text } of jobs) {
  // המכסה החינמית מוגבלת בקצב: ממתינים וחוזרים על 429 עד 4 פעמים
  let res;
  for (let attempt = 0; attempt < 5; attempt++) {
    res = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent", {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": KEY },
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
  execFileSync("ffmpeg", ["-y", "-f", "s16le", "-ar", "24000", "-ac", "1", "-i", `/tmp/${name.replace('/', '_')}.pcm`, "-af", "loudnorm=I=-16", "-ar", "22050", "-b:a", "64k", `public/audio/${name}.mp3`], { stdio: "inherit" });
  console.log("נוצר", name);
}
