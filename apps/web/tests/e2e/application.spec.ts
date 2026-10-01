import { test, expect } from "@playwright/test";
import path from "node:path";
const fixtures = path.resolve(process.cwd(), "../api/tests/fixtures");
test("new student uploads real PDFs, analyzes evidence, and simulates without changing it", async ({
  page,
}) => {
  await page.goto("/register");
  await page.getByLabel("Full name").fill("E2E Student");
  await page.getByLabel("Email address").fill(`e2e-${Date.now()}@example.com`);
  await page.getByLabel("Password", { exact: true }).fill("TestingScholarAI!2027");
  await page.getByRole("button", { name: "Create my account" }).click();
  await expect(page).toHaveURL(/onboarding/);
  await page.getByRole("button", { name: "Save & continue" }).click();
  await expect(page).toHaveURL(/documents/);
  for (const [type, file] of [
    ["CV", "alex-cv.pdf"],
    ["Transcript", "alex-transcript.pdf"],
    ["TOEFL certificate", "alex-toefl.pdf"],
  ]) {
    await page.getByLabel("Document type", { exact: true }).selectOption(type);
    await page.locator('input[type="file"]').setInputFiles(path.join(fixtures, file));
    await expect(page.getByRole("row").filter({ hasText: file })).toContainText("Processed", {
      timeout: 30000,
    });
  }
  await page.goto("/scholarships/new");
  await page.getByLabel("Scholarship or program name").fill("E2E Scholarship");
  await page
    .getByLabel("Official requirements")
    .fill(
      "GPA >= 3.0/4\nTOEFL >= 90\nCV required\nTranscript required\n2 recommendation letters required",
    );
  await page.getByRole("button", { name: "Extract requirements" }).click();
  const analyze = page.getByRole("button", { name: "Analyze my application" });
  await expect(analyze).toBeEnabled({ timeout: 30000 });
  await analyze.click();
  await expect(
    page.getByText("Potentially eligible — missing evidence", { exact: true }),
  ).toBeVisible({ timeout: 30000 });
  await page.getByRole("button", { name: "Requirements & evidence" }).click();
  await page.locator("summary").filter({ hasText: "TOEFL" }).click();
  await expect(page.getByText("96 >= 90 is true.")).toBeVisible();
  const analysisUrl = page.url();
  await page.goto(analysisUrl + "/simulate");
  await page.getByLabel("TOEFL score").fill("100");
  await page.getByLabel("Recommendation letters").fill("2");
  await page.getByRole("button", { name: "Run simulation" }).click();
  await expect(
    page.getByText("Eligible based on available evidence", { exact: true }),
  ).toBeVisible();
  await page.goto(analysisUrl);
  await page.getByRole("button", { name: "Requirements & evidence" }).click();
  await page.locator("summary").filter({ hasText: "TOEFL" }).click();
  await expect(page.getByText("96 >= 90 is true.")).toBeVisible();
  await page.getByRole("button", { name: "Application assistant" }).click();
  await page.getByRole("button", { name: "Does my TOEFL satisfy this program?" }).click();
  await expect(page.getByText(/TOEFL >= 90: satisfied/)).toBeVisible({ timeout: 30000 });
});
