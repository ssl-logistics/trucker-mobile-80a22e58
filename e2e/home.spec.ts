import { test, expect } from "@playwright/test";

test.describe("App smoke tests", () => {
  test("should load the start page", async ({ page }) => {
    await page.goto("/");
    // App ใช้ HashRouter จึง redirect ไป /#/
    await expect(page).toHaveURL(/.*#\//);
  });

  test("should not have console errors on load", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    // ยอมรับ error เกี่ยวกับ network/external API ที่อาจ block ใน test env
    const criticalErrors = errors.filter(
      (e) => !e.includes("Failed to fetch") && !e.includes("net::")
    );
    expect(criticalErrors).toHaveLength(0);
  });
});
