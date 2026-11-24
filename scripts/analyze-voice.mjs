// מעביר את ההקלטה המשופרת לגימיני לניתוח: תמלול וסגנון ביצוע, ושומר ל-docs/voice-analysis.md
import { readFileSync, writeFileSync } from "node:fs";
const KEYS = [process.env.GEMINI_API_KEY, process.env.GEMINI_API_KEY_2, process.env.GEMINI_API_KEY_3].filter(Boolean);
const b64 = readFileSync("scripts/voice-ref/recording-fixed.mp3").toString("base64");
const prompt = `זו הקלטה של בעל האתר מקריא פתיח למרכזיה טלפונית. החזר בעברית, בשני חלקים:
1) תמלול מדויק של מה שנאמר, עם ניקוד מלא, ועם סימון של ההטעמה במילים המרכזיות (למשל המילה נייחא).
2) תיאור ביצוע מפורט להנחיית מנוע הקראה (TTS): קצב (מילים בדקה, מהיר/בינוני), גובה ושפת הקול, נימה ורגש, הטעמה (מלעיל/מלרע), מיקום הפסקות ואורכן, עליות וירידות, סיום משפטים, מבטא. כתוב הנחיה קצרה בת 3-5 משפטים שאפשר להדביק לפני הטקסט.`;
let last = "";
// דגמים אפשריים: הראשי, ואחריו דגמי flash/pro שהמפתח רואה (בלי tts/image/live)
let MODELS = ["gemini-3.8-flash"];
try {
  const r = await fetch("https://generativelanguage.googleapis.com/v1beta/models?pageSize=200", { headers: { "x-goog-api-key": KEYS[0] } });
  const lj = await r.json();
  const found = (lj.models ?? []).map((m) => m.name.replace("models/", "")).filter((n) => /gemini/.test(n) && /(flash|pro)/.test(n) && !/(tts|image|live|embedding|thinking-exp|robotics|computer)/.test(n));
  console.log("דגמים זמינים:", found.join(", "));
  MODELS = [...new Set([...MODELS, ...found])];
} catch (e) { console.log("רשימת דגמים נכשלה", String(e).slice(0, 100)); }
for (let i = 0; i < 14; i++) {
  const model = MODELS[i % MODELS.length];
  const key = KEYS[i % KEYS.length];
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify({ contents: [{ parts: [{ inlineData: { mimeType: "audio/mp3", data: b64 } }, { text: prompt }] }] }),
  });
  if (res.ok) {
    const j = await res.json();
    const text = j.candidates?.[0]?.content?.parts?.map((p) => p.text).join("\n") ?? "";
    writeFileSync("docs/voice-analysis.md", `# ניתוח ההקלטה (גימיני)\n\n${text}\n`);
    console.log("נשמר docs/voice-analysis.md");
    process.exit(0);
  }
  last = `${res.status}: ${(await res.text()).slice(0, 300)}`;
  console.log("נכשל", last);
  await new Promise((r) => setTimeout(r, res.status === 429 || res.status === 503 ? 15000 : 2000));
}
console.log("כל הניסיונות נכשלו", last);
process.exit(1);
