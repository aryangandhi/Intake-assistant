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

test("Email: explains MyConnectedCare is a patient portal, before the online steps", async ({ page }) => {
  await signInToInbox(page, "jane.doe@example.com");
  await page.getByRole("link", { name: /Action needed: Complete your new patient intake form/ }).click();

  // A short plain paragraph for patients who have never heard of MyConnectedCare
  const intro = page.locator("p", { hasText: /MyConnectedCare is the Cancer Centre's secure online patient portal/i });
  await expect(intro).toBeVisible();
  await expect(intro).toContainText(/forms/i);
  await expect(intro).toContainText(/appointments/i);
  await expect(intro).toContainText(/message your care team/i);

  // Plain text, not bold
  const weight = await intro.evaluate((el) => parseInt(getComputedStyle(el).fontWeight, 10));
  expect(weight).toBeLessThan(600);

  // Between the opening paragraph and the "How to complete the form online" heading
  const opening = page.locator("p", { hasText: /Your first appointment at the Cancer Centre is on/ });
  const steps = page.getByText("How to complete the form online:");
  const y = async (l: typeof intro) => (await l.boundingBox())!.y;
  expect(await y(opening)).toBeLessThan(await y(intro));
  expect(await y(intro)).toBeLessThan(await y(steps));

  // Screenshot of the changed part: the opening paragraph, the new portal sentence and the start of the steps
  const box = (await intro.boundingBox())!;
  const open = (await opening.boundingBox())!;
  const stepsBox = (await steps.boundingBox())!;
  await page.screenshot({
    path: "docs/screenshots/email-myconnectedcare-explained.png",
    clip: { x: Math.max(open.x - 16, 0), y: open.y - 16, width: Math.max(open.width, box.width) + 32, height: stepsBox.y + stepsBox.height - open.y + 140 },
  });
});
