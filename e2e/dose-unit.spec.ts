import { test, expect, type Page, type BrowserContext } from "@playwright/test";

async function loginWith(page: Page, email: string) {
  await page.getByLabel(/email/i).first().fill(email);
  await page.getByLabel("Password", { exact: true }).fill("password");
  await page.getByRole("button", { name: /log in|sign in/i }).click();
}

async function openFromEmail(context: BrowserContext, page: Page, linkName: RegExp) {
  const [popup] = await Promise.all([context.waitForEvent("page"), page.getByRole("link", { name: linkName }).click()]);
  await popup.waitForLoadState();
  return popup;
}

test.beforeEach(async ({ page }) => {
  expect((await page.request.post("/api/reset")).ok()).toBeTruthy();
});

// Medication dose is split into "Dose" (number) and "Unit" (dropdown); a missing half is gently flagged.
test("Medications: separate Dose and Unit boxes, and a notice when one is missing", async ({ page, context }) => {
  await page.goto("/inbox");
  await loginWith(page, "jane.doe@example.com");
  await page.getByRole("link", { name: /Action needed: Complete your new patient intake form/ }).click();
  const mcc = await openFromEmail(context, page, /Open MyConnectedCare/);
  await mcc.getByRole("link", { name: /Questionnaires/ }).click();
  await mcc.getByRole("link", { name: "Start Intake Form" }).click();
  await mcc.waitForLoadState("networkidle");
  for (let i = 0; i < 10 && !(await mcc.locator("#in-med_list").count()); i++) {
    await mcc.getByRole("button", { name: "Next →" }).click();
  }

  await expect(mcc.getByText("Medication name", { exact: true })).toBeVisible();
  await expect(mcc.getByText("Dose", { exact: true })).toBeVisible();
  await expect(mcc.getByText("Unit", { exact: true })).toBeVisible();
  await expect(mcc.getByText("How often", { exact: true })).toBeVisible();

  const notice = mcc.getByTestId("dose-gap");
  await mcc.locator("#in-med_list").fill("Metformin");
  await mcc.locator("#in-med_list-0-dose").fill("500");
  await mcc.locator("#in-med_list-0-frequency").click(); // leaves the dose box
  await expect(notice).toContainText("Please choose a unit");

  await mcc.locator("#in-med_list-0-unit").selectOption("mg");
  await expect(notice).toHaveCount(0);

  await mcc.locator("#in-med_list-0-dose").fill("");
  await mcc.locator("#in-med_list-0-frequency").click();
  await expect(notice).toContainText("Please add the dose");

  // It never blocks: Next still works.
  await mcc.getByRole("button", { name: "Next →" }).click();
  await expect(mcc.locator("#in-med_list")).toHaveCount(0);
});
