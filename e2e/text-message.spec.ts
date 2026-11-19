import { test, expect, type Page } from "@playwright/test";

// Red tests for spec section 5.2b (simulated patient text message at /messages).
// They fail until the feature is built.

const PASSWORD = "password";

async function signInToInbox(page: Page, email: string) {
  await page.goto("/inbox");
  await page.getByLabel(/email/i).first().fill(email);
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: /log in|sign in/i }).click();
  await expect(page.getByRole("heading", { name: "Inbox" })).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  const res = await page.request.post("/api/reset");
  expect(res.ok()).toBeTruthy();
});

test("Seeded patient has an intake text message with the same information as the email", async ({ page }) => {
  await signInToInbox(page, "jane.doe@example.com");
  await page.goto("/messages");

  const text = page.getByTestId("text-message").first();
  await expect(text).toBeVisible();
  await expect(text).toContainText("Hi Jane");
  await expect(text).toContainText(/first appointment is on/i); // date and time
  await expect(text.getByRole("link", { name: /nurse call/i })).toBeVisible();
  await expect(text.getByRole("link", { name: /MyConnectedCare|intake form/i })).toBeVisible();
  await expect(text).toContainText(/list of your current medications/i);
});

test("The nurse call link in the text message opens the help request form", async ({ page }) => {
  await signInToInbox(page, "jane.doe@example.com");
  await page.goto("/messages");
  await page.getByTestId("text-message").first().getByRole("link", { name: /nurse call/i }).click();
  await expect(page).toHaveURL(/request-help/);
});

test("A new referral within 7 days gets a text message right away, along with the email", async ({ page, context }) => {
  const ia = await context.newPage();
  await ia.goto("/intake-assistant");
  await ia.getByLabel(/email/i).first().fill("admin@wrhn-demo.ca");
  await ia.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await ia.getByRole("button", { name: /log in|sign in/i }).click();
  await ia.getByRole("link", { name: "+ New referral" }).click();
  await ia.getByLabel("First name").fill("Text");
  await ia.getByLabel("Last name").fill("Patient");
  await ia.getByLabel("Date of birth").fill("1970-05-05");
  await ia.getByLabel("Phone").fill("519-555-0100");
  await ia.getByLabel("Email").fill("text.patient@example.com");
  const appt = new Date(Date.now() + 3 * 864e5);
  const local = new Date(appt.getTime() - appt.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  await ia.getByLabel("First appointment (date and time)").fill(local);
  await ia.getByLabel("Provider group").selectOption("Hematology");
  await ia.getByRole("button", { name: "Save referral" }).click();
  await expect(ia.getByText(/intake email was sent right away/)).toBeVisible();
  await expect(ia.getByText(/text message was sent right away/i)).toBeVisible();

  await signInToInbox(page, "text.patient@example.com");
  await page.goto("/messages");
  await expect(page.getByTestId("text-message")).toHaveCount(1);
  await expect(page.getByTestId("text-message")).toContainText("Hi Text");
});

async function adminOpensNewReferral(page: Page) {
  await page.goto("/intake-assistant");
  await page.getByLabel(/email/i).first().fill("admin@wrhn-demo.ca");
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: /log in|sign in/i }).click();
  await page.getByRole("link", { name: "+ New referral" }).click();
}

test("A referral more than 7 days away sends the email and the text together when the demo button is clicked", async ({ page, context }) => {
  const ia = await context.newPage();
  await adminOpensNewReferral(ia);
  await ia.getByLabel("First name").fill("Later");
  await ia.getByLabel("Last name").fill("Patient");
  await ia.getByLabel("Date of birth").fill("1970-05-05");
  await ia.getByLabel("Phone").fill("519-555-0200");
  await ia.getByLabel("Email").fill("later.patient@example.com");
  const appt = new Date(Date.now() + 20 * 864e5);
  const local = new Date(appt.getTime() - appt.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  await ia.getByLabel("First appointment (date and time)").fill(local);
  await ia.getByLabel("Provider group").selectOption("Hematology");
  await ia.getByRole("button", { name: "Save referral" }).click();

  // Nothing is sent yet.
  await signInToInbox(page, "later.patient@example.com");
  await expect(page.getByText("No emails yet.")).toBeVisible();
  await page.goto("/messages");
  await expect(page.getByTestId("text-message")).toHaveCount(0);

  // The demo button sends both.
  await ia.goto("/intake-assistant/referrals");
  await ia.getByRole("row", { name: /Later/ }).getByRole("button", { name: "Send intake email now (demo)" }).click();
  await page.goto("/inbox");
  await expect(page.getByRole("link", { name: /Action needed/ })).toBeVisible();
  await page.goto("/messages");
  await expect(page.getByTestId("text-message")).toHaveCount(1);
});

test("The referral form cannot be saved without a phone number or an email", async ({ page }) => {
  await adminOpensNewReferral(page);
  await expect(page.getByLabel("Phone")).toHaveAttribute("required", "");
  await expect(page.getByLabel("Email")).toHaveAttribute("required", "");
});
