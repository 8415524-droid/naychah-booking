// Module API של טכנוליין: המרכזייה קוראת לכתובת שלנו בכל שלב, ואנחנו מחזירים JSON עם המודול הבא.
export type PbxParams = Record<string, string | undefined>;
export type PbxFile = { text: string } | { fileLink: string; fileName?: string };
export type PbxModule =
  | { type: "simpleMessage"; files: PbxFile[] }
  | { type: "simpleMenu"; name: string; files: PbxFile[]; enabledKeys: string; times?: number; timeout?: number; setMusic?: "yes" | "no" }
  | { type: "getDTMF"; name: string; files: PbxFile[]; min: number; max: number; timeout?: number; confirmType?: "digits" | "number" | "no" }
  | { type: "simpleRouting"; name: string; dialPhone: string; displayNumber?: string; routingMusic?: "yes" | "no"; ringSec?: number }
  | { type: "queueRouting"; name: string; routerId?: string; router?: { waitingDuration?: number; ringDuration?: number; failingAction?: "hangup" }; phones?: string[]; continueOnFail?: "yes" }
  | { type: "record"; name: string; files: PbxFile[]; max?: number; min?: number; confirm?: "no" | "confirmOnly" | "ful"; hangupSave?: "yes" | "no" }
  | { type: "hangup" };
export type PbxResponse = PbxModule | PbxModule[];

// הקראות קבועות בקול אנושי: אם קיים קובץ מוקלט לנוסח המדויק, משמיעים אותו במקום הקראה ממוכנת.
import { existsSync } from "node:fs";
import { join } from "node:path";
import clips from "./clips.json";
const CLIP_BASE = process.env.PBX_AUDIO_BASE ?? "https://75-119-140-120.sslip.io/audio/clips";
const clipKey = new Map<string, string>((clips as { key: string; text: string }[]).map((c) => [c.text, c.key]));
const exists = new Map<string, boolean>();
export function pbxFiles(text: string): PbxFile[] {
  const key = clipKey.get(text);
  if (!key) return [{ text }];
  let ok = exists.get(key);
  if (ok === undefined) { ok = existsSync(join(process.cwd(), "public", "audio", "clips", `${key}.mp3`)); exists.set(key, ok); }
  return ok ? [{ fileLink: `${CLIP_BASE}/${key}.mp3`, fileName: `${key}_v7` }] : [{ text }];
}

export const say = (text: string): PbxModule => ({ type: "simpleMessage", files: pbxFiles(text) });
export const hangup = (): PbxModule => ({ type: "hangup" });
export const menu = (name: string, text: string, keys: string, music?: boolean): PbxModule =>
  ({ type: "simpleMenu", name, files: pbxFiles(text), enabledKeys: keys.includes(",") ? keys : keys.split("").join(","), times: 2, timeout: 6, ...(music ? { setMusic: "yes" as const } : {}) });
export const digits = (name: string, text: string, min: number, max: number): PbxModule =>
  ({ type: "getDTMF", name, files: pbxFiles(text), min, max, timeout: 8, confirmType: "no" });

export function normPhone(p: string | undefined) {
  let d = String(p ?? "").replace(/\D/g, "");
  if (d.startsWith("972")) d = "0" + d.slice(3);
  return d;
}
