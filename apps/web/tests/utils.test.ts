import { describe, it, expect } from "vitest";
import { initials, label, formatDate } from "../lib/utils";
describe("displaying evidence", () => {
  it("renders all engine statuses as readable labels", () => {
    expect(label("MISSING_EVIDENCE")).toBe("Missing evidence");
    expect(label("NOT_SATISFIED")).toBe("Not satisfied");
  });
  it("never invents a missing deadline", () => {
    expect(formatDate(null)).toBe("Not specified");
  });
  it("uses the student's initials", () => expect(initials("Alex Morgan")).toBe("AM"));
});
