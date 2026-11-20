import { test, expect } from "@playwright/test";

// Own file: these flags give the browser a fake microphone, which the other specs don't need.
test.use({
  permissions: ["microphone"],
  launchOptions: { args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"] },
});

test.beforeEach(async ({ page }) => {
  expect((await page.request.post("/api/reset")).ok()).toBeTruthy();
});

test("Recorded voice is transcribed in chunks, so text appears while the patient is still speaking", async ({ page }) => {
  // The browser's recogniser fails (as in Brave or an embedded browser), so the app records and transcribes on the server.
  await page.addInitScript(() => {
    class FailingRecognition {
      lang = "";
      interimResults = false;
      continuous = false;
      onresult: ((event: any) => void) | null = null;
      onend: (() => void) | null = null;
      onerror: ((event: any) => void) | null = null;
      start() {
        setTimeout(() => this.onerror?.({ error: "network" }), 0);
      }
      stop() {}
    }
    Object.defineProperty(window, "SpeechRecognition", { configurable: true, value: FailingRecognition });
  });
  // The first transcription hears only the start; later ones (including the final one after stop) hear everything.
  const replies = ["Hello", "Hello there my friend"];
  let calls = 0;
  await page.route("**/api/transcribe", async (route) => {
    const text = replies[Math.min(calls++, replies.length - 1)];
    await route.fulfill({ json: { text } });
  });

  await page.goto("/myconnectedcare/login");
  await page.getByLabel(/email/i).first().fill("jane.doe@example.com");
  await page.getByLabel("Password", { exact: true }).fill("password");
  await page.getByRole("button", { name: /log in|sign in/i }).click();
  await page.getByRole("link", { name: /Questionnaires/ }).click();
  await page.getByRole("link", { name: "Start Intake Form" }).click();

  const field = page.locator("#in-ay_preferred_name");
  await field.fill("Sam");
  await page.getByRole("button", { name: "Speak your answer for What name would you like us to call you?" }).click();
  await expect(page.getByText("Listening… tap to stop")).toBeVisible();

  // Text arrives from a chunk transcription while the recording is still running (no stop tap yet).
  await expect(field).toHaveValue(/^Sam Hello/, { timeout: 15_000 });
  await expect(page.getByText("Listening… tap to stop")).toBeVisible();

  await page.getByRole("button", { name: "Stop voice input for What name would you like us to call you?" }).click();
  await expect(page.getByText("Listening… tap to stop")).toBeHidden();
  await expect(field).toHaveValue("Sam Hello there my friend", { timeout: 15_000 });
});
