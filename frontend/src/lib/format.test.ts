import { describe, expect, it } from "vitest";
import { formatDateTime, formatRange, localInputToIso, localTimeZone } from "./format";

describe("format helpers", () => {
  it("formats a date-time", () => {
    expect(formatDateTime("2030-06-15T10:30:00Z")).toContain("2030");
  });

  it("formats a range with a dash between start and end", () => {
    const out = formatRange("2030-06-15T10:30:00Z", "2030-06-15T11:30:00Z");
    expect(out).toContain("2030");
    expect(out).toContain(" – ");
  });

  it("converts a datetime-local value to a UTC ISO string", () => {
    const iso = localInputToIso("2030-06-15T10:30");
    expect(iso).toBe(new Date("2030-06-15T10:30").toISOString());
    expect(iso.endsWith("Z")).toBe(true);
    const back = new Date(iso);
    expect([back.getHours(), back.getMinutes()]).toEqual([10, 30]);
  });

  it("reports a non-empty time zone", () => {
    expect(localTimeZone().length).toBeGreaterThan(0);
  });
});
