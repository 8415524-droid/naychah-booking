import { describe, expect, it } from "vitest";
import { buildIcal, isSafeIcalUrl, parseIcal } from "./ical";

describe("ical", () => {
  it("מפענח תאריכים, מדלג על מבוטלים ומשלים יום חסר", () => {
    const txt = [
      "BEGIN:VCALENDAR",
      "BEGIN:VEVENT", "DTSTART;VALUE=DATE:20261203", "DTEND;VALUE=DATE:20261205", "END:VEVENT",
      "BEGIN:VEVENT", "DTSTART:20261210T150000Z", "DTEND:20261212T100000Z", "END:VEVENT",
      "BEGIN:VEVENT", "DTSTART;VALUE=DATE:20261220", "END:VEVENT",
      "BEGIN:VEVENT", "DTSTART;VALUE=DATE:20261230", "DTEND;VALUE=DATE:20261231", "STATUS:CANCELLED", "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n");
    expect(parseIcal(txt)).toEqual([
      { from: "2026-12-03", to: "2026-12-05" },
      { from: "2026-12-10", to: "2026-12-12" },
      { from: "2026-12-20", to: "2026-12-21" },
    ]);
  });
  it("חוסם כתובות מסוכנות", () => {
    expect(isSafeIcalUrl("https://calendar.google.com/calendar/ical/x/basic.ics")).toBe(true);
    expect(isSafeIcalUrl("http://calendar.google.com/x.ics")).toBe(false);
    expect(isSafeIcalUrl("https://localhost/x")).toBe(false);
    expect(isSafeIcalUrl("https://127.0.0.1/x")).toBe(false);
    expect(isSafeIcalUrl("https://169.254.169.254/latest")).toBe(false);
    expect(isSafeIcalUrl("https://user:pw@example.com/x")).toBe(false);
    expect(isSafeIcalUrl("https://example.com:8443/x")).toBe(false);
  });
  it("בונה פיד תקין שאפשר לקרוא חזרה", () => {
    const feed = buildIcal("דירה", [{ from: "2026-12-03", to: "2026-12-05", kind: "booking" }]);
    expect(parseIcal(feed)).toEqual([{ from: "2026-12-03", to: "2026-12-05" }]);
  });
});

import { mergeRanges } from "./ical-sync";
describe("mergeRanges", () => {
  it("מאחד חפיפות וטווחים סמוכים", () => {
    expect(mergeRanges([{ from: "2026-12-05", to: "2026-12-08" }, { from: "2026-12-01", to: "2026-12-05" }, { from: "2026-12-07", to: "2026-12-10" }, { from: "2026-12-20", to: "2026-12-21" }])).toEqual([{ from: "2026-12-01", to: "2026-12-10" }, { from: "2026-12-20", to: "2026-12-21" }]);
  });
});
