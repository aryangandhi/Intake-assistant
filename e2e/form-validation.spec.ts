import { test, expect, type Page } from "@playwright/test";

// Spec: intake-prototype-build-prompt.md 5.1 and 5.4 ("Field validation"), DECISIONS.md.
// Phone must be exactly 10 digits (spaces, dashes, parentheses allowed). Email must be valid.
// Date of birth cannot be in the future. Errors show in a summary at the top (clicking an entry
// focuses the field) plus inline messages, and submit is blocked until fixed.

async function reset(page: Page) {
  expect((await page.request.post("/api/reset")).ok()).toBeTruthy();
}

async function openReferralForm(page: Page) {
  await page.goto("/intake-assistant");
  await page.getByLabel("Work email").fill("admin@wrhn-demo.ca");
  await page.getByLabel("Password", { exact: true }).fill("password");
  await page.getByRole("button", { name: /log in|sign in/i }).click();
  await expect(page).not.toHaveURL(/login/); // logged in
  await page.goto("/intake-assistant/referrals/new");
  await page.waitForLoadState("networkidle"); // wait for hydration
}

function appointmentSoon() {
  const d = new Date(Date.now() + 3 * 24 * 3600 * 1000);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T10:00`;
}

async function fillReferral(page: Page, o: { phone: string; email?: string; dob?: string }) {
  await page.getByLabel("First name").fill("Aryan");
  await page.getByLabel("Last name").fill("Gandhi");
  await page.getByLabel("Date of birth").fill(o.dob ?? "2002-01-30");
  await page.getByLabel("Phone").fill(o.phone);
  await page.getByLabel("Email").fill(o.email ?? "validation.test@example.com");
  await page.getByLabel("First appointment (date and time)").fill(appointmentSoon());
  await page.getByLabel("Provider group").selectOption("Surgical Oncology");
}

test.beforeEach(async ({ page }) => {
  await reset(page);
});

test.describe("referral form validation", () => {
  test("a phone number that is not 10 digits blocks submit and shows a summary and inline error", async ({ page }) => {
    await openReferralForm(page);
    await fillReferral(page, { phone: "34382903483290348329" }); // the Figure 6a value
    await page.getByRole("button", { name: "Save referral" }).click();

    await expect(page).toHaveURL(/\/referrals\/new/); // not saved, not redirected
    const summary = page.getByRole("alert").filter({ hasText: /Phone must be 10 digits/ });
    await expect(summary.first()).toBeVisible();
    await expect(page.locator("#phone")).toHaveAttribute("aria-invalid", "true");
  });

  test("too-short phone numbers are rejected too", async ({ page }) => {
    await openReferralForm(page);
    await fillReferral(page, { phone: "519-555-017" }); // 9 digits
    await page.getByRole("button", { name: "Save referral" }).click();
    await expect(page).toHaveURL(/\/referrals\/new/);
    await expect(page.getByText(/Phone must be 10 digits/).first()).toBeVisible();
  });

  test("a leading country code is not accepted", async ({ page }) => {
    await openReferralForm(page);
    await fillReferral(page, { phone: "+1 519 555 0177" }); // 11 digits
    await page.getByRole("button", { name: "Save referral" }).click();
    await expect(page).toHaveURL(/\/referrals\/new/);
    await expect(page.getByText(/Phone must be 10 digits/).first()).toBeVisible();
  });

  test("clicking an error in the summary focuses the incorrect field", async ({ page }) => {
    await openReferralForm(page);
    await fillReferral(page, { phone: "12345" });
    await page.getByRole("button", { name: "Save referral" }).click();
    await page.getByRole("alert").getByRole("link", { name: /Phone/ }).click();
    await expect(page.locator("#phone")).toBeFocused();
  });

  test("an invalid email and a future date of birth are reported", async ({ page }) => {
    await openReferralForm(page);
    await fillReferral(page, { phone: "5195550177", email: "a@b", dob: "2999-01-01" });
    await page.getByRole("button", { name: "Save referral" }).click();
    await expect(page).toHaveURL(/\/referrals\/new/);
    await expect(page.getByText(/Email must be a valid address/).first()).toBeVisible();
    await expect(page.getByText(/Date of birth cannot be in the future/).first()).toBeVisible();
  });

  test("all errors are listed together in one summary", async ({ page }) => {
    await openReferralForm(page);
    await fillReferral(page, { phone: "123", email: "a@b" });
    await page.getByRole("button", { name: "Save referral" }).click();
    const summary = page.getByRole("alert").filter({ hasText: /Phone must be 10 digits/ }).first();
    await expect(summary).toContainText(/Email must be a valid address/);
  });

  test("fixing the errors lets the referral save, and formatted phone numbers are accepted", async ({ page }) => {
    await openReferralForm(page);
    await fillReferral(page, { phone: "123" });
    await page.getByRole("button", { name: "Save referral" }).click();
    await expect(page.getByText(/Phone must be 10 digits/).first()).toBeVisible();

    await page.getByLabel("Phone").fill("(519) 555-0177");
    await page.getByRole("button", { name: "Save referral" }).click();
    await expect(page).toHaveURL(/\/intake-assistant\/referrals\?created=/);
    await expect(page.getByText("Aryan Gandhi").first()).toBeVisible();
  });
});

test.describe("nurse-call form validation", () => {
  async function openHelpForm(page: Page) {
    await page.goto("/intake-assistant/request-help");
    await page.waitForLoadState("networkidle");
  }
  async function fillHelp(page: Page, phone: string) {
    await page.getByLabel("Your full name").fill("Jane Doe");
    await page.getByLabel("Date of birth").fill("1966-04-12");
    await page.getByLabel("Phone number we should call").fill(phone);
  }

  test("a phone number that is not 10 digits blocks the request and shows an error", async ({ page }) => {
    await openHelpForm(page);
    await fillHelp(page, "555-12");
    await page.getByRole("button", { name: "Request a nurse call" }).click();
    await expect(page).toHaveURL(/\/request-help(\?|$)/);
    await expect(page.getByRole("alert").filter({ hasText: /Phone must be 10 digits/ }).first()).toBeVisible();
  });

  test("a valid 10-digit phone number is accepted", async ({ page }) => {
    await openHelpForm(page);
    await fillHelp(page, "519-555-0177");
    await page.getByRole("button", { name: "Request a nurse call" }).click();
    await expect(page).toHaveURL(/request-help\/thanks/);
  });
});
