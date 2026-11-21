// Intake text message template (simulated SMS). Edit the wording here; no code changes needed elsewhere.
// Placeholders: {{firstName}} {{date}} {{dateTime}} {{portalUrl}} {{helpUrl}} {{exampleUrl}}
// The text message is the same message as the email (peer feedback): keep the wording identical to src/content/intakeEmail.ts.
// The wording is word for word the same; only the sender name (INTAKE_TEXT_SENDER) is added above the message.
// The sender name shown on the text is INTAKE_TEXT_SENDER.

export const INTAKE_TEXT_SENDER = "WRHN Cancer Centre";

export const INTAKE_TEXT_HTML = `
<p>Hello {{firstName}},</p>

<p>Your first appointment at the Cancer Centre is on <strong>{{dateTime}}</strong>.
Before then, please complete your new patient intake form online.
It takes about 20 to 30 minutes and you can save and come back later.</p>

<p>MyConnectedCare is the Cancer Centre's secure online patient portal, where you can complete forms, see your appointments and message your care team.
If you have not used it before, you can sign up using the button below.</p>

<p><strong>How to complete the form online:</strong></p>
<ol>
  <li>Click the button below to log in or sign up for MyConnectedCare.</li>
  <li>Click <strong>"Questionnaires"</strong> on the left.</li>
  <li>Click <strong>"Start Intake Form"</strong>.</li>
</ol>

<p><a class="email-button" href="{{portalUrl}}">Open MyConnectedCare</a></p>

<p>Not sure how to answer? <a href="{{exampleUrl}}">See an example of a completed form</a></p>

<p>Prefer to do this over the phone? <a href="{{helpUrl}}">Request a nurse call</a> and a nurse will call you 1 to 2 days before your appointment.</p>

<p><strong>Please complete the form before your appointment on {{date}}.</strong></p>

<p>Please bring an official list of your current medications to your appointment.</p>

<p>Thank you,<br/>New Patient Intake Team<br/>Cancer Centre</p>
`;
