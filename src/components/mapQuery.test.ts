import { describe, it, expect } from "vitest";
import { mapQuery } from "./ApartmentMap";
describe("mapQuery", () => {
  it("משתמש בכתובת ומוסיף מירון", () => expect(mapQuery("הרשב\"י 5", "הגפן")).toBe("הרשב\"י 5, מירון"));
  it("בלי כתובת משתמש בשם", () => expect(mapQuery(null, "הגפן")).toBe("הגפן, מירון"));
  it("בלי כלום", () => expect(mapQuery("", "")).toBe("מירון"));
});
