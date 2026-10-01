import { test, expect } from "@playwright/test";
import path from "node:path";
const screenshots =
  process.env.SCHOLARAI_SCREENSHOT_DIR || path.resolve(process.cwd(), "../../docs/screenshots");

test("seeded demo has responsive dashboard, comparison, evidence and printable report", async ({
  page,
}) => {
  test.setTimeout(90000);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/login");
  await page.getByLabel("Email address").fill("alex@scholarai.demo");
  await page
    .getByLabel("Password", { exact: true })
    .fill(process.env.DEMO_PASSWORD || "ScholarDemo!2027");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("heading", { name: /Welcome back, Alex/ })).toBeVisible();
  await expect(
    page.getByRole("link", { name: /^Global AI Excellence Scholarship Northbridge/ }),
  ).toBeVisible();
  await page.screenshot({
    path: path.join(screenshots, "dashboard-desktop.png"),
    fullPage: true,
    animations: "disabled",
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole("heading", { name: /Welcome back, Alex/ })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.screenshot({
    path: path.join(screenshots, "dashboard-mobile.png"),
    fullPage: true,
    animations: "disabled",
  });
  await page.setViewportSize({ width: 768, height: 1024 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByRole("link", { name: /^Global AI Excellence Scholarship Northbridge/ }).click();
  await expect(page.getByRole("button", { name: "Requirements & evidence" })).toBeVisible();
  const analysisUrl = page.url();
  await page.getByRole("button", { name: "Requirements & evidence" }).click();
  await page.locator("summary").filter({ hasText: "TOEFL" }).click();
  await expect(page.getByText("96 >= 90 is true.")).toBeVisible();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: path.join(screenshots, "analysis-evidence.png"),
    fullPage: true,
    animations: "disabled",
  });
  await page.goto(analysisUrl + "/report");
  await expect(page.getByRole("heading", { name: "ScholarAI Application Analysis" })).toBeVisible();
  await expect(page.getByText(/Total Score: 96/)).toBeVisible();
  await page.emulateMedia({ media: "print" });
  await page.screenshot({
    path: path.join(screenshots, "printable-report.png"),
    fullPage: true,
    animations: "disabled",
  });
  await page.emulateMedia({ media: "screen" });
  await page.goto("/compare");
  const choices = page.getByRole("checkbox");
  await expect(choices).toHaveCount(3);
  await choices.nth(0).check();
  await choices.nth(1).check();
  await page.getByRole("button", { name: "Compare selected" }).click();
  await expect(page.getByRole("table")).toContainText("Overall Fit Score");
  await page.goto("/settings");
  await expect(page.getByRole("checkbox")).toBeVisible();
  await page.goto("/documents");
  await expect(page.getByRole("row").filter({ hasText: "alex-toefl.pdf" })).toContainText(
    "Processed",
  );
});
