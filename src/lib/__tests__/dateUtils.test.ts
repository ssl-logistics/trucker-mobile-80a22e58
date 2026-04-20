import { describe, it, expect } from "vitest";
import { formatDate, formatDateTime, formatTime } from "@/lib/dateUtils";

describe("dateUtils", () => {
  const sampleIso = "2025-12-01T02:00:00Z"; // 09:00 Bangkok

  describe("formatDate", () => {
    it("formats valid date in Thai by default", () => {
      const result = formatDate(sampleIso);
      expect(result).toMatch(/1/); // contains day
    });

    it("returns '-' for null/undefined/empty", () => {
      expect(formatDate(null)).toBe("-");
      expect(formatDate(undefined)).toBe("-");
      expect(formatDate("-")).toBe("-");
    });

    it("returns '-' for invalid date string", () => {
      expect(formatDate("not-a-date")).toBe("-");
    });

    it("formats in English locale", () => {
      const result = formatDate(sampleIso, "en");
      expect(result).toMatch(/Dec/);
    });
  });

  describe("formatDateTime", () => {
    it("includes time portion", () => {
      const result = formatDateTime(sampleIso);
      expect(result).toMatch(/09:00/);
    });
  });

  describe("formatTime", () => {
    it("returns Bangkok time HH:mm", () => {
      expect(formatTime(sampleIso)).toBe("09:00");
    });
  });
});
