// Intake text message template (simulated SMS). Edit the wording here; no code changes needed elsewhere.
// Placeholders: {{firstName}} {{dateTime}} {{portalUrl}} {{helpUrl}}
// Same information as the intake email, in short form. Keep the nurse call option near the top.

export const INTAKE_TEXT_HTML = `Cancer Centre: Hi {{firstName}}, your first appointment is on {{dateTime}}. Prefer a phone call? <a href="{{helpUrl}}">Request a nurse call</a>. Otherwise, please <a href="{{portalUrl}}">complete your intake form on MyConnectedCare</a> before then. Please bring an official list of your current medications.`;
