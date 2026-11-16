// Form validation shared by the browser and the server actions (spec: build prompt 5.1 / 5.4).
export type FieldError = { field: string; message: string };
export type FormState = { errors: FieldError[] } | null;

/** Phone numbers: spaces, dashes and parentheses are allowed; exactly 10 digits remain. */
export function isValidPhone(v: string): boolean {
  return /^\d{10}$/.test(v.replace(/[\s\-()]/g, ""));
}

export function isValidEmail(v: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

function todayLocal(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function dobError(dob: string): string | null {
  if (!dob) return "Enter a date of birth";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dob) || isNaN(new Date(dob).getTime())) return "Enter a valid date of birth";
  if (dob > todayLocal()) return "Date of birth cannot be in the future";
  return null;
}

type Values = Record<string, string>;

export function validateReferral(v: Values): FieldError[] {
  const e: FieldError[] = [];
  if (!v.firstName?.trim()) e.push({ field: "firstName", message: "Enter a first name" });
  if (!v.lastName?.trim()) e.push({ field: "lastName", message: "Enter a last name" });
  const dob = dobError(v.dob?.trim() ?? "");
  if (dob) e.push({ field: "dob", message: dob });
  if (!v.phone?.trim()) e.push({ field: "phone", message: "Phone must be 10 digits" });
  else if (!isValidPhone(v.phone)) e.push({ field: "phone", message: "Phone must be 10 digits" });
  if (!v.email?.trim()) e.push({ field: "email", message: "Enter an email" });
  else if (!isValidEmail(v.email.trim())) e.push({ field: "email", message: "Email must be a valid address" });
  const appt = v.appointmentAt?.trim();
  if (!appt) e.push({ field: "appointmentAt", message: "Enter the first appointment date and time" });
  else if (isNaN(new Date(appt).getTime())) e.push({ field: "appointmentAt", message: "Enter a valid appointment date and time" });
  if (!v.providerGroup?.trim()) e.push({ field: "providerGroup", message: "Select a provider group" });
  return e;
}

export function validateHelp(v: Values): FieldError[] {
  const e: FieldError[] = [];
  if (!v.name?.trim()) e.push({ field: "name", message: "Enter your full name" });
  const dob = dobError(v.dob?.trim() ?? "");
  if (dob) e.push({ field: "dob", message: dob });
  if (!v.phone?.trim() || !isValidPhone(v.phone)) e.push({ field: "phone", message: "Phone must be 10 digits" });
  return e;
}

export function formValues(form: HTMLFormElement): Values {
  const out: Values = {};
  new FormData(form).forEach((val, k) => {
    if (typeof val === "string") out[k] = val;
  });
  return out;
}
