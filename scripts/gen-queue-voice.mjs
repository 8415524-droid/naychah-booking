// הקראות תור ההמתנה (דיבור בלבד, בלי מוזיקה) בקול Algenib. הערבוב עם המוזיקה: scripts/mix-queue.sh
import { execFileSync } from "node:child_process";
import { writeFileSync, mkdirSync, readFileSync, existsSync } from "node:fs";
const ALL_KEYS = [process.env.GEMINI_API_KEY, process.env.GEMINI_API_KEY_2, process.env.GEMINI_API_KEY_3, process.env.GEMINI_API_KEY_4].slice(Number(process.env.SKIP_KEYS) || 0).filter(Boolean); // SKIP_KEYS=3 משאיר רק את מפתח 4
const KEYS = process.env.ONLY_KEY ? [ALL_KEYS[Number(process.env.ONLY_KEY) - 1]].filter(Boolean) : ALL_KEYS; // ONLY_KEY=2 משתמש רק במפתח 2
if (!KEYS.length) throw new Error("חסר GEMINI_API_KEY");
const STYLE = "הנחיות קריאה (אין להקריא אותן, הן רק הוראות): קול גברי בוגר, חם, בטוח בעצמו ורגוע, קצב בינוני נינוח, עברית רגילה בלי הטעמה במלעיל. הפסקה ברורה בין המשפטים ובין האפשרויות, כמו שירות לקוחות אדיב ומכבד. ";
const READ_ONLY = "\n\nהקרא עכשיו את הטקסט הבא בלבד, מילה במילה, בלי להוסיף שום מילה ובלי לשנות או להשמיט, וסיים מיד בסופו:\n";
const ALL = JSON.parse(readFileSync("src/lib/pbx/queue-clips.json", "utf8"));
mkdirSync("public/audio/queue-speech", { recursive: true });
let failed = 0;
for (const c of ALL) {
  const out = `public/audio/queue-speech/${c.key}.mp3`;
  if (existsSync(out)) continue;
  try {
    let res;
    for (let a = 0; a < 5; a++) {
      res = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent", {
        method: "POST", headers: { "content-type": "application/json", "x-goog-api-key": KEYS[a % KEYS.length] },
        body: JSON.stringify({ contents: [{ parts: [{ text: STYLE + READ_ONLY + (c.spoken ?? c.text) }] }],
          generationConfig: { responseModalities: ["AUDIO"], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: "Algenib" } } } } }),
      });
      if (res.status !== 429) break;
      console.log("429, ממתין 40 שניות"); await new Promise((r) => setTimeout(r, 40000));
    }
    if (!res.ok) throw new Error(`Gemini ${res.status}: ${(await res.text()).slice(0, 400)}`);
    const b64 = (await res.json()).candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!b64) throw new Error("לא התקבל שמע");
    const pcm = `/tmp/${c.key}.pcm`;
    writeFileSync(pcm, Buffer.from(b64, "base64"));
    execFileSync("ffmpeg", ["-y", "-f", "s16le", "-ar", "24000", "-ac", "1", "-i", pcm, "-af", "loudnorm=I=-16", "-ar", "24000", "-b:a", "64k", out], { stdio: "inherit" });
    console.log("נוצר", c.key);
  } catch (e) { failed++; console.log("נכשל", c.key, String(e).slice(0, 200)); }
}
if (failed) { console.log(`נכשלו ${failed}`); process.exitCode = 1; }
