import { describe, expect, it } from "vitest";
import { isValidEmail, isValidPhone, validateHelp, validateReferral } from "@/lib/validation";

describe("isValidPhone", () => {
  it.each(["5195550177", "519-555-0177", "(519) 555-0177", "519 555 0177"])("accepts %s", (p) => expect(isValidPhone(p)).toBe(true));
  it.each(["", "519555017", "51955501777", "+1 519 555 0177", "519-555-01ab", "34382903483290348329"])("rejects %s", (p) => expect(isValidPhone(p)).toBe(false));
});

describe("isValidEmail", () => {
  it("accepts normal addresses and rejects a@b", () => {
    expect(isValidEmail("jane@example.com")).toBe(true);
    expect(isValidEmail("a@b")).toBe(false);
    expect(isValidEmail("no spaces@x.com")).toBe(false);
  });
});

const ok = { firstName: "A", lastName: "G", dob: "2002-01-30", phone: "5195550177", email: "a@b.ca", appointmentAt: "2030-01-01T10:00", providerGroup: "Hematology" };

describe("validateReferral", () => {
  it("passes a complete referral", () => expect(validateReferral(ok)).toEqual([]));
  it("flags phone, email and a future date of birth", () => {
    const fields = validateReferral({ ...ok, phone: "123", email: "a@b", dob: "2999-01-01" }).map((e) => e.field);
    expect(fields).toEqual(["dob", "phone", "email"]);
  });
  it("flags missing fields", () => expect(validateReferral({}).length).toBe(7));
});

describe("validateHelp", () => {
  it("requires name, dob and a 10-digit phone", () => {
    expect(validateHelp({ name: "J D", dob: "1966-04-12", phone: "519-555-0177" })).toEqual([]);
    expect(validateHelp({ name: "", dob: "", phone: "55" }).map((e) => e.field)).toEqual(["name", "dob", "phone"]);
  });
});
