// תור המתנה משלנו: מחכים לנציג דקה בכל סבב (מוזיקה), ובסוף כל דקה, ובין הסבבים אומרים "הנך מספר X" ומציעים להשאיר הודעה.
import { existsSync } from "node:fs";
import { join } from "node:path";
import { menu, pbxFiles, say, type PbxModule, type PbxParams } from "./types";

const QUEUE_CLIP_BASE = process.env.PBX_QUEUE_AUDIO_BASE ?? "https://75-119-140-120.sslip.io/audio/queue";
const QUEUE_CLIP_VER = "v1"; // להעלות כשמחליפים קובץ: טכנוליין שומרת במטמון לפי שם הקובץ
/** הקראה מוקלטת (מעורבבת עם המוזיקה) של "הנך מספר X" + האפשרויות. null = אין קובץ (נופלים להקראה ממוכנת). */
export function queuePositionClip(pos: number): { fileLink: string; fileName: string } | null {
  if (!Number.isInteger(pos) || pos < 1 || pos > 10) return null;
  const key = `queue_pos_${pos}`;
  if (!existsSync(join(process.cwd(), "public", "audio", "queue", `${key}.mp3`))) return null;
  return { fileLink: `${QUEUE_CLIP_BASE}/${key}.mp3`, fileName: `${key}_${QUEUE_CLIP_VER}` };
}

export const QUEUE_ROUND_SEC = 60;
export const QUEUE_MAX_ROUNDS = 8;
export const RECORD_BUSY_TEXT = "כרגע לא ניתן להשיג נציג. אנא השאירו הודעה אחרי הצליל, כולל שם ומספר טלפון, ונחזור אליכם בהקדם.";
const FAIL = ["NOAGENTS", "NOANSWER", "ERROR"];

export function recordModule(text = RECORD_BUSY_TEXT): PbxModule {
  return { type: "record", name: "msg", max: 120, min: 2, confirm: "no", hangupSave: "yes", files: pbxFiles(text) };
}

export function queueRound(round: number, phones: string[]): PbxModule {
  return { type: "queueRouting", name: `queueResult${round}`, continueOnFail: "yes", phones,
    router: { waitingDuration: QUEUE_ROUND_SEC, ringDuration: 25, failingAction: "hangup" } };
}

/** הסבב האחרון שחזר מהתור (0 = עדיין לא נכנסו לתור). */
export function lastRound(q: PbxParams): number {
  let n = 0;
  for (const k of Object.keys(q)) { const m = /^queueResult(\d+)$/.exec(k); if (m) n = Math.max(n, Number(m[1])); }
  return n;
}

export interface QueueDeps {
  /** רושם/מרענן את המתקשר בתור ומחזיר את מקומו (1 = הראשון). */
  position(callId: string, kind: string): Promise<number>;
  leave(callId: string): Promise<void>;
}

/** מה להחזיר כשסבב בתור הסתיים. null = זו לא חזרה מהתור. */
export async function afterRound(q: PbxParams, kind: string, phones: string[], deps: QueueDeps | undefined): Promise<PbxModule[] | null> {
  const n = lastRound(q);
  if (!n) return null;
  const result = q[`queueResult${n}`] ?? "";
  if (!FAIL.includes(result)) return null; // נענה או הסתיים: הלקוח מסיים
  console.log("pbx queue result", n, result, q[`STEXT_queueResult${n}`] ?? "");
  const choice = q[`waitq${n}`];
  if (choice === "4" || n >= QUEUE_MAX_ROUNDS) return [recordModule()];
  if (choice !== undefined) return [queueRound(n + 1, phones)]; // בחר להמשיך להמתין (או לא הקיש)
  const callId = q.PBXcallId ?? "";
  const pos = deps && callId ? await deps.position(callId, kind) : 1;
  const clip = queuePositionClip(pos);
  if (clip) return [{ type: "simpleMenu", name: `waitq${n}`, files: [clip], enabledKeys: "4", times: 1, timeout: 3, setMusic: "yes" }];
  return [say(`הנך מספר ${pos} בתור.`), menu(`waitq${n}`, "להשארת הודעה הקישו 4. להמשך המתנה אל תקישו דבר.", "4")].map((m) =>
    m.type === "simpleMenu" ? { ...m, times: 1, timeout: 3, setMusic: "yes" as const } : m);
}
