// Spec-derived tests for splitting the medication dose into "dose" and "unit"
// (DECISIONS.md, "Separate dose and unit"). Written ahead of the code: RED until it is built.
import { describe, expect, it } from "vitest";
import { getQuestion } from "@/config/intakeQuestions";
import { formatAnswer, type RawItem } from "@/lib/answers";
import { applyDoseGaps } from "@/lib/ai/doseGaps";
import type { ModelSummary } from "@/lib/ai/schema";
import { checkMedication, doseText, isDoseIncomplete } from "@/lib/medicationCheck";

const q = getQuestion("med_list")!;
const empty = (): ModelSummary => ({ paragraph: [], sections: [], flagged: [] });
const medItem = (items: Record<string, string>[]): RawItem[] => [
  { field_id: "med_list", section: "Current medications", question: q.label, answer: formatAnswer(q, { items }), incomplete: false },
];

describe("spec: the medication row has separate dose and unit fields", () => {
  it("lists name, dose, unit, how often in that order", () => {
    expect((q.repeatFields || []).map((f) => f.id)).toEqual(["name", "dose", "unit", "frequency"]);
  });
  it("unit is a pick list that includes mg, g and mcg", () => {
    const unit = (q.repeatFields || []).find((f) => f.id === "unit");
    expect(unit?.options).toEqual(expect.arrayContaining(["mg", "g", "mcg"]));
  });
});

describe("spec: the unusual dose check reads dose and unit together", () => {
  it("joins dose and unit", () => {
    expect(doseText({ dose: "500", unit: "mg" })).toBe("500 mg");
    expect(doseText({ dose: "500 mg" })).toBe("500 mg"); // rows saved before the split
  });
  it("still flags 100 g of metformin when entered as dose 100 + unit g", () => {
    expect(checkMedication("Metformin", doseText({ dose: "100", unit: "g" }), "once a day")).not.toBeNull();
    expect(checkMedication("Metformin", doseText({ dose: "500", unit: "mg" }), "twice a day")).toBeNull();
  });
});

describe("spec: a missing dose or unit is flagged", () => {
  it("is incomplete when the name is filled and the dose or unit is blank", () => {
    expect(isDoseIncomplete({ name: "Metformin", dose: "", unit: "mg", frequency: "daily" })).toBe(true);
    expect(isDoseIncomplete({ name: "Metformin", dose: "500", unit: "", frequency: "daily" })).toBe(true);
    expect(isDoseIncomplete({ name: "Metformin", dose: "500", unit: "mg", frequency: "daily" })).toBe(false);
  });
  it("is not incomplete for an empty row, or an old row whose dose text already has the unit", () => {
    expect(isDoseIncomplete({})).toBe(false);
    expect(isDoseIncomplete({ name: "Metformin", dose: "500 mg", frequency: "daily" })).toBe(false);
  });
  it("raw data shows dose and unit as one token, with a marker for what is missing", () => {
    expect(formatAnswer(q, { items: [{ name: "Metformin", dose: "500", unit: "mg", frequency: "twice a day" }] })).toBe("Metformin, 500 mg, twice a day");
    expect(formatAnswer(q, { items: [{ name: "Ramipril", dose: "10", unit: "", frequency: "daily" }] })).toContain("(unit missing)");
    expect(formatAnswer(q, { items: [{ name: "Ramipril", dose: "", unit: "mg", frequency: "daily" }] })).toContain("(dose missing)");
  });
  it("adds a Current medications bullet and a flagged item by code", () => {
    const out = applyDoseGaps(empty(), medItem([{ name: "Ramipril", dose: "10", unit: "", frequency: "daily" }]));
    const meds = out.sections.find((s) => s.heading === "Current medications")!;
    expect(meds.bullets.some((b) => /unit/i.test(b.text) && b.text.includes("Ramipril"))).toBe(true);
    expect(out.flagged.some((f) => f.field_id === "med_list" && /unit/i.test(f.note))).toBe(true);
  });
  it("adds nothing when every row is complete, and does not add twice", () => {
    const ok = applyDoseGaps(empty(), medItem([{ name: "Ramipril", dose: "10", unit: "mg", frequency: "daily" }]));
    expect(ok.flagged).toHaveLength(0);
    const rows = medItem([{ name: "Ramipril", dose: "", unit: "mg", frequency: "daily" }]);
    const twice = applyDoseGaps(applyDoseGaps(empty(), rows), rows);
    expect(twice.flagged.filter((f) => f.field_id === "med_list")).toHaveLength(1);
  });
});
