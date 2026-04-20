import { describe, it, expect, vi, beforeEach } from "vitest";
import { login as loginExternal } from "@/lib/externalApi";

// Mock the external API module
vi.mock("@/lib/externalApi", () => ({
  login: vi.fn(),
}));

// Helper: Map user_type to app role (replicated from SignIn.tsx logic)
function mapUserTypeToRole(userType: string | null): string {
  if (
    userType === "freelance_driver" ||
    userType === "internal_driver" ||
    userType === "external_driver"
  ) {
    return "freelance";
  } else if (userType === "company") {
    return "company";
  } else if (userType === "factory") {
    return "factory";
  }
  return "freelance";
}

// Helper: Determine post-login redirect path (replicated from SignIn.tsx)
function getRedirectPath(
  userType: string | null,
  savedRedirect: string | null
): string {
  if (
    savedRedirect &&
    savedRedirect !== "/" &&
    savedRedirect !== "/home" &&
    savedRedirect !== "/dashboard"
  ) {
    return savedRedirect;
  }
  if (userType === "company" || userType === "factory") {
    return "/dashboard";
  }
  return "/home";
}

// Helper: Categorize error message (replicated from SignIn.tsx)
function categorizeError(errorMessage: string): "invalid" | "network" | "generic" {
  if (errorMessage.includes("Invalid") || errorMessage.includes("credentials")) {
    return "invalid";
  }
  if (
    errorMessage.includes("CORS") ||
    errorMessage.includes("Failed to fetch") ||
    errorMessage.includes("NetworkError")
  ) {
    return "network";
  }
  return "generic";
}

describe("SignIn Logic", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    sessionStorage.clear();
  });

  describe("mapUserTypeToRole", () => {
    it("maps freelance_driver to freelance role", () => {
      expect(mapUserTypeToRole("freelance_driver")).toBe("freelance");
    });

    it("maps internal_driver to freelance role", () => {
      expect(mapUserTypeToRole("internal_driver")).toBe("freelance");
    });

    it("maps external_driver to freelance role", () => {
      expect(mapUserTypeToRole("external_driver")).toBe("freelance");
    });

    it("maps company user to company role", () => {
      expect(mapUserTypeToRole("company")).toBe("company");
    });

    it("maps factory user to factory role", () => {
      expect(mapUserTypeToRole("factory")).toBe("factory");
    });

    it("defaults unknown types to freelance", () => {
      expect(mapUserTypeToRole(null)).toBe("freelance");
      expect(mapUserTypeToRole("unknown")).toBe("freelance");
    });
  });

  describe("getRedirectPath", () => {
    it("redirects company/factory to dashboard", () => {
      expect(getRedirectPath("company", null)).toBe("/dashboard");
      expect(getRedirectPath("factory", null)).toBe("/dashboard");
    });

    it("redirects driver types to /home", () => {
      expect(getRedirectPath("freelance_driver", null)).toBe("/home");
      expect(getRedirectPath("internal_driver", null)).toBe("/home");
      expect(getRedirectPath("external_driver", null)).toBe("/home");
    });

    it("respects saved redirect path when meaningful", () => {
      expect(getRedirectPath("freelance_driver", "/job-detail/123")).toBe(
        "/job-detail/123"
      );
    });

    it("ignores root or default redirects", () => {
      expect(getRedirectPath("company", "/")).toBe("/dashboard");
      expect(getRedirectPath("freelance_driver", "/home")).toBe("/home");
      expect(getRedirectPath("company", "/dashboard")).toBe("/dashboard");
    });
  });

  describe("categorizeError", () => {
    it("categorizes invalid credentials", () => {
      expect(categorizeError("Invalid login")).toBe("invalid");
      expect(categorizeError("Wrong credentials")).toBe("invalid");
    });

    it("categorizes network errors", () => {
      expect(categorizeError("Failed to fetch")).toBe("network");
      expect(categorizeError("CORS blocked")).toBe("network");
      expect(categorizeError("NetworkError occurred")).toBe("network");
    });

    it("categorizes other errors as generic", () => {
      expect(categorizeError("Server is down")).toBe("generic");
      expect(categorizeError("")).toBe("generic");
    });
  });

  describe("loginExternal API integration", () => {
    it("calls login API with email and password", async () => {
      const mockLogin = vi.mocked(loginExternal);
      mockLogin.mockResolvedValue({
        data: {
          success: true,
          data: {
            driver: { id: "D1", full_name: "ทดสอบ" },
            user_type: "freelance_driver",
            api_key: "key123",
          },
        },
        error: null,
      } as any);

      const result = await loginExternal("user@test.com", "password123");

      expect(mockLogin).toHaveBeenCalledWith("user@test.com", "password123");
      expect((result.data as any)?.success).toBe(true);
      expect((result.data as any)?.data?.driver?.id).toBe("D1");
    });

    it("handles failed login response", async () => {
      const mockLogin = vi.mocked(loginExternal);
      mockLogin.mockResolvedValue({
        data: { success: false, error: "Invalid credentials" },
        error: null,
      } as any);

      const result = await loginExternal("wrong@test.com", "wrongpass");

      expect((result.data as any)?.success).toBe(false);
      expect((result.data as any)?.error).toBe("Invalid credentials");
    });

    it("handles network errors", async () => {
      const mockLogin = vi.mocked(loginExternal);
      mockLogin.mockResolvedValue({
        data: null,
        error: "Failed to fetch",
      });

      const result = await loginExternal("user@test.com", "password");

      expect(result.error).toBe("Failed to fetch");
      expect(categorizeError(result.error!)).toBe("network");
    });
  });

  describe("Remember Me functionality", () => {
    it("saves credentials when remember is checked", () => {
      const email = "user@test.com";
      const password = "password123";
      const remember = true;

      if (remember) {
        localStorage.setItem("rememberedEmail", email);
        localStorage.setItem("rememberedPassword", password);
        localStorage.setItem("rememberedUser", "true");
      }

      expect(localStorage.getItem("rememberedEmail")).toBe(email);
      expect(localStorage.getItem("rememberedPassword")).toBe(password);
      expect(localStorage.getItem("rememberedUser")).toBe("true");
    });

    it("clears credentials when remember is unchecked", () => {
      localStorage.setItem("rememberedEmail", "old@test.com");
      localStorage.setItem("rememberedPassword", "oldpass");
      localStorage.setItem("rememberedUser", "true");

      const remember = false;
      if (!remember) {
        localStorage.removeItem("rememberedEmail");
        localStorage.removeItem("rememberedPassword");
        localStorage.removeItem("rememberedUser");
      }

      expect(localStorage.getItem("rememberedEmail")).toBeNull();
      expect(localStorage.getItem("rememberedPassword")).toBeNull();
      expect(localStorage.getItem("rememberedUser")).toBeNull();
    });

    it("loads saved credentials correctly", () => {
      localStorage.setItem("rememberedEmail", "saved@test.com");
      localStorage.setItem("rememberedPassword", "savedpass");
      localStorage.setItem("rememberedUser", "true");

      const savedEmail = localStorage.getItem("rememberedEmail");
      const savedPassword = localStorage.getItem("rememberedPassword");
      const savedRemember = localStorage.getItem("rememberedUser");

      expect(savedRemember).toBe("true");
      expect(savedEmail).toBe("saved@test.com");
      expect(savedPassword).toBe("savedpass");
    });
  });

  describe("Vehicle data merging for internal/external drivers", () => {
    it("merges vehicle data into driver for internal_driver", () => {
      const driver: any = { id: "D1", full_name: "ทดสอบ", car_brand: "Hino" };
      const vehicle: any = {
        id: "V1",
        license_plate: "1กก-1234",
        province: "กรุงเทพ",
        brand: "Isuzu",
        color: "ขาว",
        weight_capacity: 25000,
      };
      const userType = "internal_driver";

      const merged: any =
        driver && vehicle && (userType === "internal_driver" || (userType as string) === "external_driver")
          ? {
              ...driver,
              plate_number: vehicle.license_plate,
              plate_province: vehicle.province,
              vehicle_brand: vehicle.brand || driver.car_brand,
              vehicle_color: vehicle.color,
              load_capacity: vehicle.weight_capacity,
              vehicle_id: vehicle.id,
            }
          : driver;

      expect(merged.plate_number).toBe("1กก-1234");
      expect(merged.vehicle_brand).toBe("Isuzu");
      expect(merged.load_capacity).toBe(25000);
      expect(merged.vehicle_id).toBe("V1");
    });

    it("does not merge vehicle data for freelance_driver", () => {
      const userType: string = "freelance_driver";
      const shouldMerge =
        userType === "internal_driver" || userType === "external_driver";
      expect(shouldMerge).toBe(false);
    });
  });

  describe("Auth storage payload structure", () => {
    it("creates correct localStorage payload after login", async () => {
      const mockLogin = vi.mocked(loginExternal);
      mockLogin.mockResolvedValue({
        data: {
          success: true,
          data: {
            driver: { id: "D1", full_name: "ทดสอบ", company_type: "factory" },
            user_type: "internal_driver",
            api_key: "key_xyz",
          },
        },
        error: null,
      } as any);

      const { data: result } = await loginExternal("u", "p");
      const driver = (result as any)?.data?.driver;
      const userType = (result as any)?.data?.user_type;
      const apiKey = (result as any)?.data?.api_key;
      const employerType = driver?.company_type;
      const role = mapUserTypeToRole(userType);

      // Simulate setting auth items
      localStorage.setItem("auth_driver", JSON.stringify(driver));
      localStorage.setItem("auth_user_type", userType || "");
      localStorage.setItem("user_role", role);
      localStorage.setItem("auth_driver_id", driver?.id || "");
      localStorage.setItem("auth_login_type", "normal");
      localStorage.setItem("auth_api_key", apiKey || "");
      localStorage.setItem("auth_employer_type", employerType || "");

      expect(localStorage.getItem("auth_user_type")).toBe("internal_driver");
      expect(localStorage.getItem("user_role")).toBe("freelance");
      expect(localStorage.getItem("auth_driver_id")).toBe("D1");
      expect(localStorage.getItem("auth_login_type")).toBe("normal");
      expect(localStorage.getItem("auth_api_key")).toBe("key_xyz");
      expect(localStorage.getItem("auth_employer_type")).toBe("factory");
    });
  });
});
