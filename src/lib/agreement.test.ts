import { describe, expect, it } from "vitest";
import { buildAgreement } from "./agreement";

describe("הסכם בעל נכס", () => {
  it("ממלא בעל נכס וחברה בסדר הנכון", () => {
    const out = buildAgreement({ name: "משה כהן", phone: "0501234567" }, { name: "נייחא" }, "1 בכסלו");
    const names = out.filter((l) => l.startsWith("שם / חברה:"));
    expect(names[0]).toBe("שם / חברה: משה כהן");
    expect(names[1]).toBe("שם / חברה: נייחא");
    expect(out.find((l) => l.startsWith("שנערך ונחתם"))).toContain("1 בכסלו");
  });
});
