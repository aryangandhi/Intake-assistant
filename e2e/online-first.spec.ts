import { test, expect, type Page } from "@playwright/test";

// Online intake is offered first; the nurse call option follows (peer feedback).
// Saves screenshots to docs/screenshots for the pull request.

async function signInToInbox(page: Page, email: string) {
  await page.goto("/inbox");
  await page.getByLabel(/email/i).first().fill(email);
  await page.getByLabel("Password", { exact: true }).fill("password");
  await page.getByRole("button", { name: /log in|sign in/i }).click();
  await expect(page.getByRole("heading", { name: "Inbox" })).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  const res = await page.request.post("/api/reset");
  expect(res.ok()).toBeTruthy();
});

test("Email: online intake comes before the nurse call option", async ({ page }) => {
  await signInToInbox(page, "jane.doe@example.com");
  await page.getByRole("link", { name: /Action needed: Complete your new patient intake form/ }).click();

  const online = page.getByRole("link", { name: "Open MyConnectedCare" });
  const nurse = page.getByRole("link", { name: "Request a nurse call" });
  await expect(online).toBeVisible();
  await expect(nurse).toBeVisible();

  const onlineBox = (await online.boundingBox())!;
  const nurseBox = (await nurse.boundingBox())!;
  expect(onlineBox.y).toBeLessThan(nurseBox.y);

  // The nurse option is a plain link, not bold
  const weight = await nurse.evaluate((el) => parseInt(getComputedStyle(el).fontWeight, 10));
  expect(weight).toBeLessThan(600);

  await page.screenshot({ path: "docs/screenshots/email-online-first.png", fullPage: true });
});

test("Text message: online intake comes before the nurse call option", async ({ page }) => {
  await signInToInbox(page, "jane.doe@example.com");
  await page.goto("/messages");
  const text = page.getByTestId("text-message").first();
  const online = text.getByRole("link", { name: /complete your intake form online/i });
  const nurse = text.getByRole("link", { name: /nurse call/i });
  await expect(online).toBeVisible();
  await expect(nurse).toBeVisible();
  expect((await online.boundingBox())!.y * 10000 + (await online.boundingBox())!.x)
    .toBeLessThan((await nurse.boundingBox())!.y * 10000 + (await nurse.boundingBox())!.x);

  await page.screenshot({ path: "docs/screenshots/text-online-first.png", fullPage: true });
});
