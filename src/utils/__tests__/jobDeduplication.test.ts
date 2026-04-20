import { describe, it, expect } from "vitest";
import {
  deduplicateJobs,
  filterByOrderCodes,
  extractOrderCodes,
  hasJobWithOrderCode,
  mergeJobSources,
} from "@/utils/jobDeduplication";

describe("jobDeduplication", () => {
  describe("deduplicateJobs", () => {
    it("removes duplicate jobs by order_number", () => {
      const jobs = [
        { order_number: "OR001", price: 1000 },
        { order_number: "OR001", price: 2000 },
        { order_number: "OR002", price: 3000 },
      ];
      const result = deduplicateJobs(jobs);
      expect(result).toHaveLength(2);
    });

    it("falls back to order_code when order_number is missing", () => {
      const jobs = [
        { order_code: "OC001" },
        { order_code: "OC001" },
        { order_code: "OC002" },
      ];
      expect(deduplicateJobs(jobs)).toHaveLength(2);
    });

    it("prioritizes factory job data when duplicates exist", () => {
      const jobs = [
        { order_number: "OR001", price: 1000, isFactoryJob: false },
        { order_number: "OR001", price: 2000, isFactoryJob: true },
      ];
      const result = deduplicateJobs(jobs);
      expect(result).toHaveLength(1);
      expect(result[0].price).toBe(2000);
      expect(result[0].isFactoryJob).toBe(true);
    });

    it("skips jobs without any identifier", () => {
      const jobs = [{ price: 100 }, { order_number: "OR001" }];
      expect(deduplicateJobs(jobs)).toHaveLength(1);
    });

    it("handles empty array", () => {
      expect(deduplicateJobs([])).toEqual([]);
    });
  });

  describe("filterByOrderCodes", () => {
    it("excludes jobs whose order_number is in the set", () => {
      const jobs = [
        { order_number: "OR001" },
        { order_number: "OR002" },
        { order_number: "OR003" },
      ];
      const result = filterByOrderCodes(jobs, new Set(["OR002"]));
      expect(result).toHaveLength(2);
      expect(result.map((j) => j.order_number)).toEqual(["OR001", "OR003"]);
    });

    it("keeps jobs without order codes", () => {
      const jobs = [{ id: "x" }, { order_number: "OR001" }];
      const result = filterByOrderCodes(jobs, new Set(["OR001"]));
      expect(result).toHaveLength(1);
    });
  });

  describe("extractOrderCodes", () => {
    it("returns a set of unique codes", () => {
      const jobs = [
        { order_number: "OR001" },
        { order_code: "OR002" },
        { order_number: "OR001" },
      ];
      const set = extractOrderCodes(jobs);
      expect(set.size).toBe(2);
      expect(set.has("OR001")).toBe(true);
      expect(set.has("OR002")).toBe(true);
    });

    it("respects filter function", () => {
      const jobs = [
        { order_number: "OR001", isFactoryJob: true },
        { order_number: "OR002", isFactoryJob: false },
      ];
      const set = extractOrderCodes(jobs, (j) => Boolean(j.isFactoryJob));
      expect(set.size).toBe(1);
      expect(set.has("OR001")).toBe(true);
    });
  });

  describe("hasJobWithOrderCode", () => {
    it("detects existing order code", () => {
      const jobs = [{ order_number: "OR001" }, { order_code: "OR002" }];
      expect(hasJobWithOrderCode(jobs, "OR001")).toBe(true);
      expect(hasJobWithOrderCode(jobs, "OR002")).toBe(true);
      expect(hasJobWithOrderCode(jobs, "OR999")).toBe(false);
    });
  });

  describe("mergeJobSources", () => {
    it("merges and prioritizes factory jobs", () => {
      const company = [{ order_number: "OR001", price: 1000 }];
      const factory = [{ order_number: "OR001", price: 5000 }];
      const result = mergeJobSources<any>(company, factory);
      expect(result).toHaveLength(1);
      expect(result[0].price).toBe(5000);
      expect(result[0].isFactoryJob).toBe(true);
    });

    it("includes jobs that exist only in one source", () => {
      const company = [{ order_number: "OR001" }];
      const factory = [{ order_number: "OR002" }];
      expect(mergeJobSources(company, factory)).toHaveLength(2);
    });
  });
});
