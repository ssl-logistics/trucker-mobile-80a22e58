import { describe, it, expect } from "vitest";
import { getDriverTypeFromUserType } from "@/utils/driverTypeMapping";

describe("getDriverTypeFromUserType", () => {
  it("maps internal_driver to internal", () => {
    expect(getDriverTypeFromUserType("internal_driver")).toBe("internal");
  });

  it("maps external_driver to external", () => {
    expect(getDriverTypeFromUserType("external_driver")).toBe("external");
  });

  it("maps freelance_driver to freelance", () => {
    expect(getDriverTypeFromUserType("freelance_driver")).toBe("freelance");
  });

  it("defaults unknown values to freelance", () => {
    expect(getDriverTypeFromUserType("anything_else")).toBe("freelance");
    expect(getDriverTypeFromUserType("")).toBe("freelance");
  });
});
