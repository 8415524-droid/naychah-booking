import { describe, expect, it } from "vitest";
import { parseCompleted } from "./events";

describe("אירוע completed", () => {
  it("שיחה נכנסת שנענתה: קישור הקלטה ומשך", () => {
    const r = parseCompleted({ event: "completed", direction: "in", from: "0501234567", status: "ANSWER", answerLength: 33.8, recordingUrl: "https://audio.ipsales.co.il/x.opus" });
    expect(r).toEqual({ phone: "0501234567", direction: "in", recordingUrl: "https://audio.ipsales.co.il/x.opus", durationS: 34, status: "ANSWER" });
  });
  it("הקלטה רק בתוך legs", () => {
    expect(parseCompleted({ event: "completed", from: "972501234567", legs: [{ recordingUrl: "https://a/b.opus" }] })?.recordingUrl).toBe("https://a/b.opus");
  });
  it("לא נענתה: בלי הקלטה", () => {
    expect(parseCompleted({ event: "completed", from: "0501234567", status: "NOANSWER", recordingUrl: "" })?.recordingUrl).toBeNull();
  });
  it("דוחה אירוע אחר וקישור לא מאובטח", () => {
    expect(parseCompleted({ event: "answer" })).toBeNull();
    expect(parseCompleted({ event: "completed", recordingUrl: "javascript:alert(1)" })?.recordingUrl).toBeNull();
  });
});
