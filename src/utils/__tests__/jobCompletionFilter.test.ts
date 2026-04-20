import { describe, it, expect } from "vitest";
import {
  isInternationalJob,
  buildCheckinMaps,
  isJobFullyCompleted,
  filterCompletedJobs,
} from "@/utils/jobCompletionFilter";

describe("jobCompletionFilter", () => {
  describe("isInternationalJob", () => {
    it("detects job with bl_no", () => {
      expect(isInternationalJob({ bl_no: "BL123" })).toBe(true);
    });

    it("detects job with booking_no", () => {
      expect(isInternationalJob({ booking_no: "BK123" })).toBe(true);
    });

    it("detects non-domestic transport_category", () => {
      expect(isInternationalJob({ transport_category: "international" })).toBe(true);
    });

    it("returns false for domestic-only job", () => {
      expect(isInternationalJob({ transport_category: "domestic" })).toBe(false);
      expect(isInternationalJob({})).toBe(false);
    });
  });

  describe("buildCheckinMaps", () => {
    it("counts POD checkins per order", () => {
      const checkins = [
        {
          freelance_driver_id: "D1",
          checkin_type: "delivery_confirmed",
          order_number: "OR001",
        },
        {
          freelance_driver_id: "D1",
          checkin_type: "delivery_confirmed_2",
          order_number: "OR001",
        },
        {
          freelance_driver_id: "OTHER",
          checkin_type: "delivery_confirmed",
          order_number: "OR001",
        },
      ];
      const maps = buildCheckinMaps(checkins, "D1", "freelance");
      expect(maps.podCountByOrderNumber["OR001"]).toBe(2);
    });

    it("tracks container return confirmations", () => {
      const checkins = [
        {
          internal_driver_id: "D1",
          checkin_type: "container_return_confirmed",
          order_number: "OR001",
        },
      ];
      const maps = buildCheckinMaps(checkins, "D1", "internal");
      expect(maps.containerReturnConfirmedByOrderNumber.has("OR001")).toBe(true);
    });
  });

  describe("isJobFullyCompleted", () => {
    it("returns true when all PODs completed (domestic)", () => {
      const job = { id: "1", order_number: "OR001", destinations: [{}, {}] };
      const maps = buildCheckinMaps(
        [
          { freelance_driver_id: "D1", checkin_type: "delivery_confirmed", order_number: "OR001" },
          { freelance_driver_id: "D1", checkin_type: "delivery_confirmed_2", order_number: "OR001" },
        ],
        "D1"
      );
      expect(isJobFullyCompleted(job, maps)).toBe(true);
    });

    it("returns false when PODs incomplete", () => {
      const job = { id: "1", order_number: "OR001", destinations: [{}, {}] };
      const maps = buildCheckinMaps(
        [{ freelance_driver_id: "D1", checkin_type: "delivery_confirmed", order_number: "OR001" }],
        "D1"
      );
      expect(isJobFullyCompleted(job, maps)).toBe(false);
    });

    it("requires container return for international jobs", () => {
      const job = { id: "1", order_number: "OR001", bl_no: "BL1", destinations: [{}] };
      const podsOnly = buildCheckinMaps(
        [{ freelance_driver_id: "D1", checkin_type: "delivery_confirmed", order_number: "OR001" }],
        "D1"
      );
      expect(isJobFullyCompleted(job, podsOnly)).toBe(false);

      const withReturn = buildCheckinMaps(
        [
          { freelance_driver_id: "D1", checkin_type: "delivery_confirmed", order_number: "OR001" },
          { freelance_driver_id: "D1", checkin_type: "container_return_confirmed", order_number: "OR001" },
        ],
        "D1"
      );
      expect(isJobFullyCompleted(job, withReturn)).toBe(true);
    });

    it("returns false when status is in_progress regardless of checkins", () => {
      const job = {
        id: "1",
        order_number: "OR001",
        status: "in_progress",
        destinations: [{}],
      };
      const maps = buildCheckinMaps(
        [{ freelance_driver_id: "D1", checkin_type: "delivery_confirmed", order_number: "OR001" }],
        "D1"
      );
      expect(isJobFullyCompleted(job, maps)).toBe(false);
    });

    it("treats job with no destinations as single-destination", () => {
      const job = { id: "1", order_number: "OR001" };
      const maps = buildCheckinMaps(
        [{ freelance_driver_id: "D1", checkin_type: "delivery_confirmed", order_number: "OR001" }],
        "D1"
      );
      expect(isJobFullyCompleted(job, maps)).toBe(true);
    });
  });

  describe("filterCompletedJobs", () => {
    it("returns only fully-completed jobs", () => {
      const jobs = [
        { id: "1", order_number: "OR001", destinations: [{}] },
        { id: "2", order_number: "OR002", destinations: [{}] },
      ];
      const checkins = [
        { freelance_driver_id: "D1", checkin_type: "delivery_confirmed", order_number: "OR001" },
      ];
      const result = filterCompletedJobs(jobs, checkins, "D1");
      expect(result).toHaveLength(1);
      expect(result[0].order_number).toBe("OR001");
    });
  });
});
