// Intake text message template (simulated SMS). Edit the wording here; no code changes needed elsewhere.
// Placeholders: {{firstName}} {{dateTime}} {{portalUrl}} {{helpUrl}}
// Same information as the intake email, in short form. Online intake comes first; the nurse call option follows it.

export const INTAKE_TEXT_HTML = `Cancer Centre: Hi {{firstName}}, your first appointment is on {{dateTime}}. Please <a href="{{portalUrl}}">complete your intake form online on MyConnectedCare</a> before then. Prefer a phone call? <a href="{{helpUrl}}">Request a nurse call</a>. Please bring an official list of your current medications.`;
