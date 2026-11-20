# Decisions and assumptions

Where the brief was unclear, I chose the simplest option that keeps the demo working.

## Process
- The brief asked for a plan and a go-ahead first. Aryan's request was to build it, so I built it in one pass and listed the plan in the project thread.
- Only the whiteboard wireframe was attached. The MyConnectedCare screenshot, EMR chart screenshot, example clinic note and sample write-up were not, so those layouts follow the brief's descriptions (left nav + main panel; EMR patient banner + left menu; clinic note headings in the given order; HPI-style paragraph).

## Stack
- Next.js 15 App Router, TypeScript, Tailwind CSS 3, Prisma 6 + SQLite, OpenAI SDK pointed at OpenRouter, zod, Vitest, Playwright.
- No shadcn/ui: a handful of hand-written components keeps installs small and avoids a code generator.
- No web fonts (system fonts only), so the app works fully offline except for the AI call.
- Default model `openai/gpt-4.1-mini`: supports strict JSON-schema output, fast, cheap. Change with `AI_MODEL`.

## Auth and accounts
- Prototype auth: each system stores the logged-in user id in its own cookie (`proto_mcc`, `proto_ia`, `proto_emr`, `proto_inbox`), so each system has a separate login. Passwords are plain text in seed data (fine for a class demo). All passwords are `password`.
- All passwords are `password` (Aryan's request, 2026-11-08).
- The intake email's **Open MyConnectedCare** button goes to `/myconnectedcare/open?ref=<referral id>`, which signs that patient in to the portal (creating their account with password `password` if needed). This saves a second login during the demo. Signing in to the inbox as a different patient signs the portal out, so the portal follows the inbox patient.
- The simulated mail inbox accepts any referred patient's email with `password`, even before they have a MyConnectedCare account, because a real person has email before they sign up for the portal.
- Jane Doe already has a MyConnectedCare account (so testers can follow the card's login details). Robert Chen has no account, to demo **Sign up**. Sign-up requires an email that matches a referral and the matching date of birth, and links the account to that referral.
- The nurse account works in both Intake Assistant and the EMR. The admin and co-op accounts work only in Intake Assistant; the oncologist only in the EMR.

- `DISABLE_LOGIN="true"` (demo mode, on by default in `.env.example`) skips password screens. The inbox still asks which patient you are, so each round can use a different patient. Systems with one obvious user default to that user (portal: the patient signed in to the inbox, else Jane Doe; EMR: Dr. Santos, with "Switch user" to pick the nurse). Intake Assistant has three roles, so it shows one-click role buttons instead. The Playwright tests run with the flag off so the real login screens stay covered.

## Email
- The email template lives in `src/content/intakeEmail.ts`. It is rendered when the email is "sent" and stored, so editing the template affects new emails (reset the demo to regenerate seeded ones).
- Links in the email open in a new tab, like real webmail.
- "Request a nurse call" in the email includes the referral id, so the help form is pre-filled. Without it, the form matches a referral by date of birth and last name.
- Emails are scheduled for 7 days before the appointment. There is no background job; the referral list shows the scheduled date and has **Send intake email now (demo)**. Referrals with an appointment 7 days away or less are sent on save.
- Form validation (referral form and nurse-call form): phone must be exactly 10 digits. Spaces, dashes and parentheses are allowed and stripped before counting; a leading country code is not accepted. Errors appear in a summary at the top that focuses the bad field, plus inline messages, and submit is blocked until fixed. The server re-validates.

## Intake form
- 10 patient sections, about 25 visible questions (more appear through conditional logic). Wording is a draft, marked "pending Health Sciences review" in the config file.
- Added "What sex were you assigned at birth?" so the pregnancy / breastfeeding question can be conditional (the brief's gynecological example). Full gynecological history was left out to keep the form short.
- Repeatable lists (medications, surgeries, family history) have a "none" checkbox, so "I don't take any medications" counts as an answer and is not flagged.
- Required = every visible, non-optional question. Preferred name and the vitals are optional. Unanswered required questions are stored as `incompleteFields` and listed under Flagged / missing items.
- Autosave runs about 1 second after each change. "Save and finish later" saves and returns to Questionnaires.
- Read aloud: when the toggle is on, each question is read when you move into it, and each question gets a Listen button. The microphone uses the browser's speech recognition where it works (Chrome, Edge, Safari). In Brave, Firefox, or when that service fails, it records audio and sends it to `/api/transcribe` (OpenRouter, `TRANSCRIBE_MODEL`, needs `OPENROUTER_API_KEY`). A note reminds patients to check voice-entered medication names.
- Live voice typing: with the browser's speech recognition, interim results are on, so text appears in the answer box as the patient speaks (existing text is kept and the new words are added after it). The recording fallback cannot stream, so there the text appears after the patient taps stop, with "Turning your words into text…" shown meanwhile.
- Read aloud also speaks the answer options for yes/no, single-choice and multiple-choice questions ("The options are: ..."), both when a question is read on entry and from the Listen button. Added after feedback that the options (for example in "What sex were you assigned at birth?") were not read. Spoken text is built in `src/lib/readAloud.ts`.
- Read aloud also reads back the response. When a question already has an answer, Listen (and the read on entering the question) says the question followed by "You responded <answer>." and skips the options list. Added so patients who cannot read their own entries can verify them. Answers are formatted with `formatAnswer` in `src/lib/answers.ts`.
- The patient portal uses an 18px base font and high-contrast colours.
- The nurse / co-op PowerForm uses the same questions plus an optional "Vital signs (to be measured at visit)" section. If the patient had started the online form, the PowerForm is pre-filled with those answers. The language from a nurse-call request is pre-filled too.

## AI summary
- Runs in the background (Next.js `after()`) right after a patient or nurse submits, so the patient sees the thank-you screen immediately. The EMR document shows "Your care team's summary is being prepared…" and refreshes every 2 seconds until it is ready.
- Referral details (name, DOB, age, provider group, appointment) are added to the raw data as a "Patient details (from referral)" section, so statements like "a 59-year-old woman referred to Medical Oncology" have something to cite.
- Attempt 1 uses `response_format: json_schema` (strict). If the response doesn't parse or pass zod, attempt 2 asks for plain JSON. If that fails too, or the API errors or times out (20 s), the template fallback is used.
- Any incomplete field the model forgets to flag is added to `flagged` automatically.
- Validation: citations must point to fields with non-empty answers (invalid ones are dropped from the chips and recorded). Every number in a statement must appear in its cited answers ("7/10" matches "7 out of 10"; "5" does not match "500"). Failing statements are kept, highlighted amber, with the tooltip "Not linked to a patient answer. Please verify."
- Margaret Wilson's seeded summary is pre-written (labelled "Seeded demo summary"), so the EMR has a finished example without an API call. It includes one deliberately unsupported bullet ("2 cm mass") to show the amber highlight.

## EMR
- Citation numbers follow the order of the raw form data, so [14] is the 14th row.
- "Mark as verified" is shown only for documents with an AI summary. Co-op documents are already reviewed by a nurse.
- "Copy to clinic note" fills Medical History (HPI paragraph + medical history + procedures), Current Medications, Allergies, Social History and Family History, without citation markers, and leaves the other sections alone. Clicking it again overwrites those five sections. For co-op documents it copies the raw answers instead (no AI involved).
- One clinic note per patient.
- The banner allergy line comes from the latest intake in the chart.

## Co-op flow
- Co-op submissions go to the nurse's "Co-op review queue". The nurse can edit answers, then **Approve and send to EMR** or **Return to student** (comment required). Returned intakes appear under the student's "My submitted intakes" with a "Fix and resubmit" button.
- The patient status chip shows "Co-op: pending review", then "In EMR" after approval.

## Reset
- `seedDemo()` deletes all rows and re-inserts the seed data. It is used by `npm run setup`, `npm run reset`, the hub button and `POST /api/reset` (used by the tests). The hub button also clears all prototype login cookies.
- Appointment dates are relative to the moment of reset (Jane: 6 days out at 10:00, so her email was "sent" yesterday).

## v2 changes (team feedback, Nov 8 doc and Nov 9 call)
- Sensory needs and health conditions are now a Yes / No question, then a pick list (checkboxes, not a dropdown, so older patients can see every choice at once) and an optional free-text box.
- "Medicine" is now "medication" everywhere on the form.
- Removed the substitute decision-maker questions (not legally binding on an intake form). The emergency contact question covers who to call. The advance care plan question stays, with an "i" button that explains what it is.
- Mood questions now ask how often in the past month (Not at all / Several days / More than half the days / Nearly every day), like a PHQ-2.
- "Demo: fill in randomly" on the patient form and the PowerForm fills every blank question with believable answers. Answers already typed are kept.
- AI point-form summary has a "Copy all points" button. Copy buttons fall back to a non-clipboard-API copy when the page is opened over plain http (e.g. a second laptop on the same Wi-Fi).
- The "Open MyConnectedCare" email button now redirects with a relative URL. Before, it redirected to localhost, which failed on a teammate's laptop through the Cloudflare tunnel.
- Text message: the intake text message mirrors the email content in short form and is sent together with the email. It is simulated only (no real SMS). Email and phone are both required on a referral, so the email and the text message are always sent together. Added to the spec as section 5.2b; built (see `/messages`).
- Online intake first: in both the email and the text message, the online intake instructions and MyConnectedCare link come first, and the nurse call option follows as a plain secondary option. Patient feedback was that a bolded nurse call option at the top looked like the preferred choice and skimmers would pick it. Both options remain. Updated in spec 5.2 and 5.2b.

## v3: unusual medication check ("Are you sure?")
- When a patient (or nurse) leaves a medication row's dose or "how often" box, the row is checked for doses that look like typing mistakes, e.g. metformin 100 g/day (typical maximum about 3 g/day). If it looks unusual, a notice under the row asks **"Are you sure about your dose of {medication} {dose}/{frequency}?"** with two buttons: **Yes** and **No**.
- **No** moves the cursor to the dose box so they can fix it, and clears any earlier Yes for that row. **Yes** records that the person confirmed the dose. Editing the name, dose or frequency afterwards cancels the confirmation and asks again.
- This is a typing check, not medical advice. It never changes what was typed. Autosave still saves drafts, but **Next, "Save and finish later" and "Send to my care team" pause** until each unusual row is answered: the form jumps to the medications step and shows the question on every unusual row. Yes lets them continue; No (or fixing the dose) also does.
- A row is "unusual" when the total per day is above the typical maximum for a short list of common medications kept in `src/lib/medicationCheck.ts` (metformin, ramipril, acetaminophen, tamoxifen and others), or, for any medication, a single dose of 10 g or more, or more than 12 doses a day. Medications not in the list are only checked with the generic rules.
- Doses are read in mg, g or mcg; "/day", "per day" or "a day" in the dose box means the dose is already a daily total. Frequencies can be words ("twice a day"), "every 8 hours" / "q8h", or BID / TID / QID. Numbers may use thousands separators ("1,500 mg") or a decimal comma ("0,5 g"). Entries that cannot be read (for example "as directed") are not flagged.
- **The confirmation travels with the answer.** It is saved on the medication row, and the raw data shows that row as, e.g., "Metformin, 100 g/day, once a day (patient confirmed this unusual dose)".
- **AI summary and consultation note:** every confirmed unusual dose is (1) added as a bullet under Current medications ("Patient confirmed this dose as correct when asked 'Are you sure?': …. Please verify at the visit.") and (2) added to Flagged / missing items. This is added by code after the AI responds (and in the template fallback), so it does not depend on the model. "Copy to clinic note" copies the Current medications bullet into the note. The AI is told never to change or "correct" the dose.
- A row where the person answered No and left the dose unchanged is not marked as confirmed. No hides the question and lets them continue; the raw data shows the row with "(patient said this dose is incorrect)" and the summary adds a Flagged item asking the oncologist to confirm the dose. Editing the row afterwards asks again.

## v3: unusual medication name check (spelling)
- Feedback from our community partner: patients can type a medication name that is wrong (for example "meform" for metformin) and nothing flags it. So the dose check above has a sibling for the **name**.
- When a person leaves a medication row's name box, the name is checked against a short list of common medication names kept in `src/lib/medicationCheck.ts` (the same list used for dose limits, plus other common names). A name is "unusual" when it is not on the list and is not an exact match, for example one or two letters off ("meform", "metformine").
- If it looks unusual, a notice under the row asks **"Are you sure about the medication's spelling?"** and shows up to 3 suggested spellings (for example "Metformin"). Clicking a suggestion replaces the name. Two buttons: **Yes** (the spelling is correct as typed) and **No** (the spelling is wrong; the cursor moves to the name box so they can fix it, or they click a suggestion). The notice appears after the person leaves the name box, not while they type.
- This is a typing check, not medical advice. It never changes the name by itself, and names not close to anything on the list (brand names, new drugs) are not flagged.
- Editing the name afterwards cancels any earlier Yes and asks again. Pausing works like the dose check: autosave still saves, but **Next, "Save and finish later" and "Send to my care team" pause** until each unusual name is answered. Yes, No, or clicking a suggestion all let them continue, so nobody is stuck if they do not know the right spelling.
- **The outcome travels with the answer, whether or not the name was corrected.** It is saved on the medication row. The raw data shows, for example, "Meform, 500 mg, twice a day (patient confirmed this spelling as typed)", "Meform, 500 mg, twice a day (patient said this spelling is incorrect)" (a No that was left uncorrected) or "Metformin, 500 mg, twice a day (patient corrected from 'meform')".
- **AI summary and consultation note:** each of these is (1) added by code as a bullet under Current medications ("Patient was asked 'Are you sure about the medication's spelling?' and confirmed 'meform' as typed. Please check against their medication list." or the corrected version) and (2) added to Flagged / missing items. Like the dose confirmations, this is added after the AI responds (and in the template fallback). The AI is told never to change or "correct" a medication name. "Copy to clinic note" copies the bullet into the note.
- **Bring your list:** the form keeps asking patients to bring their official medication list to the first appointment, so the oncologist can cross-check the names, doses and spellings on the form against it.
- Built: `checkMedicationName` and the row markers are in `src/lib/medicationCheck.ts`, the notice is in `QuestionInput.tsx`, and the summary bullets are added by `src/lib/ai/nameConfirmations.ts`. Covered by `tests/medicationName.spec.test.ts` and two Playwright scenarios in `e2e/scenarios.spec.ts`.
