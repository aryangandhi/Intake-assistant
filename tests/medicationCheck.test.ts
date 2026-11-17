import { describe, expect, it } from "vitest";
import { CONFIRM_KEY, checkMedication, confirmationQuestion, medSignature } from "@/lib/medicationCheck";
import { formatAnswer, type RawItem } from "@/lib/answers";
import { getQuestion } from "@/config/intakeQuestions";
import type { ModelSummary } from "@/lib/ai/schema";
import { applyDoseConfirmations } from "@/lib/ai/doseConfirmations";

describe("checkMedication", () => {
  it("flags metformin 100 g/day", () => {
    expect(checkMedication("Metformin", "100 g/day", "")).not.toBeNull();
    expect(checkMedication("Metformin", "100 g", "once a day")).not.toBeNull();
  });
  it("accepts normal doses", () => {
    expect(checkMedication("Metformin", "500 mg", "twice a day")).toBeNull();
    expect(checkMedication("Levothyroxine", "50 mcg", "once daily")).toBeNull();
    expect(checkMedication("Ramipril", "10 mg", "once a day")).toBeNull();
  });
  it("multiplies by frequency", () => {
    expect(checkMedication("Metformin", "1000 mg", "four times a day")).not.toBeNull();
    expect(checkMedication("Acetaminophen", "500 mg", "every 4 hours")).toBeNull();
  });
  it("flags large unknown-drug doses and too many doses", () => {
    expect(checkMedication("Mystery pill", "20 g", "once a day")).not.toBeNull();
    expect(checkMedication("Mystery pill", "10 mg", "every 1 hour")).not.toBeNull();
  });
  it("ignores unreadable entries", () => {
    expect(checkMedication("Metformin", "as directed", "")).toBeNull();
    expect(checkMedication("Vitamin D", "2 tablets", "daily")).toBeNull();
  });
});

describe("dose confirmation", () => {
  const q = getQuestion("med_list")!;
  const row = { name: "Metformin", dose: "100 g/day", frequency: "once a day" };
  it("words the question", () => {
    expect(confirmationQuestion(row)).toBe("Are you sure about your dose of Metformin 100 g/day/once a day?");
    expect(confirmationQuestion({ name: "Metformin", dose: "100 g/day", frequency: "" })).toBe("Are you sure about your dose of Metformin 100 g/day?");
  });
  it("marks a confirmed row, and drops the mark when the row changes", () => {
    const ok = { ...row, [CONFIRM_KEY]: medSignature(row) };
    expect(formatAnswer(q, { items: [ok] })).toBe("Metformin, 100 g/day, once a day (patient confirmed this unusual dose)");
    expect(formatAnswer(q, { items: [{ ...ok, dose: "200 g/day" }] })).not.toContain("confirmed");
    expect(formatAnswer(q, { items: [row] })).not.toContain("confirmed");
  });
  it("adds a medication bullet and a flag to the summary", () => {
    const ok = { ...row, [CONFIRM_KEY]: medSignature(row) };
    const items: RawItem[] = [{ field_id: "med_list", section: "Current medications", question: "", answer: formatAnswer(q, { items: [ok, { name: "Ramipril", dose: "10 mg", frequency: "daily" }] }), incomplete: false }];
    const out = applyDoseConfirmations<ModelSummary>({ paragraph: [], sections: [], flagged: [] }, items);
    expect(out.sections[0].heading).toBe("Current medications");
    expect(out.sections[0].bullets).toHaveLength(1);
    expect(out.sections[0].bullets[0].text).toContain("Metformin, 100 g/day, once a day");
    expect(out.flagged[0].field_id).toBe("med_list");
  });
});
