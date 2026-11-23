// Module API של טכנוליין: המרכזייה קוראת לכתובת שלנו בכל שלב, ואנחנו מחזירים JSON עם המודול הבא.
export type PbxParams = Record<string, string | undefined>;
export type PbxFile = { text: string } | { fileLink: string };
export type PbxModule =
  | { type: "simpleMessage"; files: PbxFile[] }
  | { type: "simpleMenu"; name: string; files: PbxFile[]; enabledKeys: string; times?: number; timeout?: number; setMusic?: "yes" | "no" }
  | { type: "getDTMF"; name: string; files: PbxFile[]; min: number; max: number; timeout?: number; confirmType?: "digits" | "number" | "no" }
  | { type: "simpleRouting"; name: string; dialPhone: string; displayNumber?: string; routingMusic?: "yes" | "no"; ringSec?: number }
  | { type: "queueRouting"; name: string; routerId: string }
  | { type: "hangup" };
export type PbxResponse = PbxModule | PbxModule[];

export const say = (text: string): PbxModule => ({ type: "simpleMessage", files: [{ text }] });
export const hangup = (): PbxModule => ({ type: "hangup" });
export const menu = (name: string, text: string, keys: string, music?: boolean): PbxModule =>
  ({ type: "simpleMenu", name, files: [{ text }], enabledKeys: keys.includes(",") ? keys : keys.split("").join(","), times: 2, timeout: 6, ...(music ? { setMusic: "yes" as const } : {}) });
export const digits = (name: string, text: string, min: number, max: number): PbxModule =>
  ({ type: "getDTMF", name, files: [{ text }], min, max, timeout: 8, confirmType: "no" });

export function normPhone(p: string | undefined) {
  let d = String(p ?? "").replace(/\D/g, "");
  if (d.startsWith("972")) d = "0" + d.slice(3);
  return d;
}
