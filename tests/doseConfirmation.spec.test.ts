// Spec-derived tests for the medication dose confirmation (DECISIONS.md, "v3: unusual medication check").
// Written ahead of fixes: some of these are expected to be RED until the gaps they expose are closed.
import { describe, expect, it } from "vitest";
import { getQuestion } from "@/config/intakeQuestions";
import { formatAnswer, type RawItem } from "@/lib/answers";
import { applyDoseConfirmations } from "@/lib/ai/doseConfirmations";
import { buildTemplateSummary } from "@/lib/ai/fallback";
import type { ModelSummary } from "@/lib/ai/schema";
import { validateSummary } from "@/lib/ai/validate";
import { noteFromSummary } from "@/lib/clinicNote";
import { CONFIRM_KEY, checkMedication, medSignature } from "@/lib/medicationCheck";

const q = getQuestion("med_list")!;
const empty = (): ModelSummary => ({ paragraph: [], sections: [], flagged: [] });
const confirmed = (name: string, dose: string, frequency: string) => {
  const r = { name, dose, frequency };
  return { ...r, [CONFIRM_KEY]: medSignature(r) };
};
const medItem = (items: Record<string, string>[]): RawItem[] => [
  { field_id: "med_list", section: "Current medications", question: q.label, answer: formatAnswer(q, { items }), incomplete: false },
];

describe("spec: which doses are unusual", () => {
  it("reads common frequency abbreviations (BID, TID, QID, q8h)", () => {
    expect(checkMedication("Metformin", "1500 mg", "TID")).not.toBeNull(); // 4.5 g/day
    expect(checkMedication("Metformin", "1000 mg", "QID")).not.toBeNull(); // 4 g/day
    expect(checkMedication("Acetaminophen", "1500 mg", "q8h")).not.toBeNull(); // 4.5 g/day
    expect(checkMedication("Metformin", "500 mg", "BID")).toBeNull();
  });
  it("accepts dose written without a space, and uppercase units", () => {
    expect(checkMedication("Metformin", "100g", "once a day")).not.toBeNull();
    expect(checkMedication("Metformin", "500MG", "twice a day")).toBeNull();
  });
  it("flags 'per day' wording and thousands separators", () => {
    expect(checkMedication("Metformin", "100 g per day", "")).not.toBeNull();
    expect(checkMedication("Metformin", "100,000 mg", "daily")).not.toBeNull();
  });
  it("flags a decimal-comma slip such as 0,5 g read as 5 g only when it is truly large", () => {
    expect(checkMedication("Metformin", "0,5 g", "twice a day")).toBeNull();
  });
  it("does not flag unreadable entries", () => {
    expect(checkMedication("Metformin", "as directed", "")).toBeNull();
    expect(checkMedication("Metformin", "", "twice a day")).toBeNull();
  });
});

describe("spec: confirmation travels with the answer", () => {
  it("a No (cleared confirmation) is not marked", () => {
    const r = { name: "Metformin", dose: "100 g/day", frequency: "once a day", [CONFIRM_KEY]: "" };
    expect(formatAnswer(q, { items: [r] })).not.toContain("confirmed");
  });
  it("a Yes on a row that is later corrected to a normal dose is not marked", () => {
    const r = { ...confirmed("Metformin", "100 g/day", "once a day"), dose: "500 mg" };
    expect(formatAnswer(q, { items: [r] })).not.toContain("confirmed");
  });
  it("only the confirmed row of several is marked", () => {
    const ans = formatAnswer(q, { items: [confirmed("Metformin", "100 g/day", "once a day"), { name: "Ramipril", dose: "10 mg", frequency: "daily" }] });
    expect(ans.match(/confirmed/g)).toHaveLength(1);
    expect(ans.split("; ")[1]).toBe("Ramipril, 10 mg, daily");
  });
});

describe("spec: AI summary and consultation note", () => {
  const items = medItem([confirmed("Metformin", "100 g/day", "once a day")]);

  it("adds exactly one bullet and one flag, even if applied twice", () => {
    const out = applyDoseConfirmations(applyDoseConfirmations(empty(), items), items);
    expect(out.sections.find((s) => s.heading === "Current medications")!.bullets).toHaveLength(1);
    expect(out.flagged.filter((f) => f.field_id === "med_list")).toHaveLength(1);
  });
  it("adds nothing when no dose was confirmed", () => {
    const out = applyDoseConfirmations(empty(), medItem([{ name: "Ramipril", dose: "10 mg", frequency: "daily" }]));
    expect(out.sections).toHaveLength(0);
    expect(out.flagged).toHaveLength(0);
  });
  it("survives summary validation (numbers are supported by the cited answer)", () => {
    const out = applyDoseConfirmations(empty(), items);
    const { checked } = validateSummary(out, items.map((i) => ({ field_id: i.field_id, answer: i.answer })), ["med_list"]);
    expect(checked.sections[0].bullets).toHaveLength(1);
    expect(checked.flagged).toHaveLength(1);
  });
  it("appears in the template fallback exactly once in Current medications", () => {
    const tpl = applyDoseConfirmations(buildTemplateSummary(items, []), items);
    const meds = tpl.sections.find((s) => s.heading === "Current medications")!;
    expect(meds.bullets.filter((b) => b.text.includes("confirmed this dose as correct"))).toHaveLength(1);
  });
  it("is copied into the clinic note's Current medications", () => {
    const out = applyDoseConfirmations(empty(), items);
    const note = noteFromSummary(out as never);
    expect(note.currentMedications).toContain("Metformin, 100 g/day, once a day");
    expect(note.currentMedications).toContain("Please verify");
  });
  it("does not leak the internal marker or key into the note text", () => {
    const out = applyDoseConfirmations(empty(), items);
    expect(JSON.stringify(noteFromSummary(out as never))).not.toContain(CONFIRM_KEY);
  });
});
