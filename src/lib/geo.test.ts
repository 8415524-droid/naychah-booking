import { describe, it, expect } from "vitest";
import { parseCoords, walkLabel } from "./geo";
describe("parseCoords", () => {
  it("זוג מספרים", () => expect(parseCoords("32.9812, 35.4411")).toEqual({ lat: 32.9812, lng: 35.4411 }));
  it("קישור גוגל מפות עם @", () => expect(parseCoords("https://www.google.com/maps/place/x/@32.98,35.44,17z")).toEqual({ lat: 32.98, lng: 35.44 }));
  it("קישור עם !3d!4d", () => expect(parseCoords("...!3d32.981!4d35.441")).toEqual({ lat: 32.981, lng: 35.441 }));
  it("טקסט לא תקין", () => expect(parseCoords("הרשב״י 5")).toBeNull());
  it("מחוץ לטווח", () => expect(parseCoords("320.1, 35.4")).toBeNull());
});
describe("walkLabel", () => {
  it("ריק", () => expect(walkLabel(null)).toBe(""));
  it("דקה", () => expect(walkLabel(1)).toBe("דקה הליכה מהציון"));
  it("דקות", () => expect(walkLabel(7)).toBe("7 דקות הליכה מהציון"));
});
