import { test, expect, type Page } from "@playwright/test";

// Tests for spec section 5.2b (simulated patient text message at /messages).
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

test("Seeded patient has an intake text message with the exact same information as the email", async ({ page }) => {
  await signInToInbox(page, "jane.doe@example.com");
  await page.getByRole("link", { name: /Action needed: Complete your new patient intake form/ }).click();
  const emailBody = await page.locator("p", { hasText: /Your first appointment at the Cancer Centre is on/ }).locator("xpath=..").innerText();

  await page.goto("/messages");
  const text = page.getByTestId("text-message").first();
  await expect(text).toBeVisible();

  // Sent from "WRHN Cancer Centre", with no "Cancer Centre:" prefix in the body
  await expect(text.getByTestId("text-sender")).toHaveText("WRHN Cancer Centre");
  const body = await text.innerText();
  expect(body).not.toMatch(/^\s*Cancer Centre:/m);

  // Every paragraph of the email is in the text, word for word
  const normalise = (t: string) => t.replace(/\s+/g, " ").trim();
  const paragraphs = emailBody
    .split("\n")
    .map(normalise)
    .filter((l) => l && l !== "Open MyConnectedCare");
  expect(paragraphs.length).toBeGreaterThan(8);
  for (const line of paragraphs) expect(normalise(body)).toContain(line);

  // All the email's links are in the text
  await expect(text.getByRole("link", { name: "Open MyConnectedCare" })).toBeVisible();
  await expect(text.getByRole("link", { name: /example of a completed form/i })).toBeVisible();
  await expect(text.getByRole("link", { name: "Request a nurse call" })).toBeVisible();
  await expect(text).toContainText("Hello Jane");
  await expect(text).toContainText(/secure online patient portal/i);
  await expect(text).toContainText(/Start Intake Form/);
  await expect(text).toContainText(/list of your current medications/i);
  // Online intake is offered before the nurse call option
  expect(body.search(/Open MyConnectedCare/)).toBeLessThan(body.search(/Request a nurse call/));
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

  // The nurse checks the intake status and sees that both messages were sent.
  const nurse = await context.newPage();
  await nurse.goto("/intake-assistant");
  await nurse.getByLabel(/email/i).first().fill("nurse@wrhn-demo.ca");
  await nurse.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await nurse.getByRole("button", { name: /log in|sign in/i }).click();
  await nurse.goto("/intake-assistant/upcoming");
  const nurseRow = nurse.getByRole("row", { name: /Patient, Text/ });
  await expect(nurseRow.getByText("Email and Text Message sent")).toBeVisible();
  await nurse.screenshot({ path: "docs/screenshots/nurse-upcoming-email-and-text-sent.png", fullPage: true });

  await signInToInbox(page, "text.patient@example.com");
  await page.goto("/messages");
  await expect(page.getByTestId("text-message")).toHaveCount(1);
  await expect(page.getByTestId("text-message")).toContainText("Hello Text");
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
  const row = ia.getByRole("row", { name: /Later/ });
  await row.getByRole("button", { name: "Send intake email now (demo)" }).click();
  await expect(row.getByRole("button", { name: "Send intake email now (demo)" })).toHaveCount(0); // wait for the send to finish
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
