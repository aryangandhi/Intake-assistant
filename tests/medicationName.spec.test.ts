// RED tests (TDD) for the medication NAME spelling check (DECISIONS.md, "v3: unusual medication name check").
// None of this exists yet. Names below are the proposed API; adjust them if the design changes, then make them green.
//   src/lib/medicationCheck.ts:
//     checkMedicationName(name) -> { message, suggestions: string[] } | null
//     NAME_CONFIRM_KEY      row key holding the exact name the person said Yes to
//     NAME_ORIGINAL_KEY     row key holding the unusual text that was replaced by a suggestion / fix
//     NAME_CONFIRMED_MARKER, nameCorrectedMarker(original)  text appended to the formatted answer
//     isNameConfirmed(row), isNameCorrected(row), isNameUnanswered(row)
//     nameConfirmationQuestion(row)
//   src/lib/ai/nameConfirmations.ts:
//     applyNameConfirmations(summary, items)
import { describe, expect, it } from "vitest";
import { getQuestion } from "@/config/intakeQuestions";
import { formatAnswer, type RawItem } from "@/lib/answers";
import { applyNameConfirmations } from "@/lib/ai/nameConfirmations";
import { buildTemplateSummary } from "@/lib/ai/fallback";
import type { ModelSummary } from "@/lib/ai/schema";
import { validateSummary } from "@/lib/ai/validate";
import { noteFromSummary } from "@/lib/clinicNote";
import {
  NAME_CONFIRM_KEY,
  NAME_CONFIRMED_MARKER,
  NAME_ORIGINAL_KEY,
  NAME_WRONG_KEY,
  NAME_WRONG_MARKER,
  checkMedicationName,
  isNameConfirmed,
  isNameMarkedWrong,
  isNameCorrected,
  isNameUnanswered,
  nameConfirmationQuestion,
  nameCorrectedMarker,
} from "@/lib/medicationCheck";

const q = getQuestion("med_list")!;
const empty = (): ModelSummary => ({ paragraph: [], sections: [], flagged: [] });
const medItem = (items: Record<string, string>[]): RawItem[] => [
  { field_id: "med_list", section: "Current medications", question: q.label, answer: formatAnswer(q, { items }), incomplete: false },
];
const asTyped = (name: string, dose = "500 mg", frequency = "twice a day") => ({ name, dose, frequency, [NAME_CONFIRM_KEY]: name });
const corrected = (original: string, name: string, dose = "500 mg", frequency = "twice a day") => ({ name, dose, frequency, [NAME_ORIGINAL_KEY]: original });

describe("spec: which names are unusual", () => {
  it("flags the example from the feedback: 'meform' for metformin", () => {
    const w = checkMedicationName("meform");
    expect(w).not.toBeNull();
    expect(w!.suggestions[0]).toBe("Metformin");
  });
  it("flags names one or two letters off", () => {
    expect(checkMedicationName("metformine")?.suggestions).toContain("Metformin");
    expect(checkMedicationName("metfromin")?.suggestions).toContain("Metformin"); // swapped letters
    expect(checkMedicationName("ramipryl")?.suggestions).toContain("Ramipril");
    expect(checkMedicationName("acetaminophn")?.suggestions).toContain("Acetaminophen");
  });
  it("gives at most 3 suggestions, each a properly spelled name", () => {
    const s = checkMedicationName("meform")!.suggestions;
    expect(s.length).toBeGreaterThan(0);
    expect(s.length).toBeLessThanOrEqual(3);
    for (const x of s) expect(x).toMatch(/^[A-Z][a-z]+$/);
  });
  it("accepts names on the list, in any case and with stray spaces", () => {
    expect(checkMedicationName("Metformin")).toBeNull();
    expect(checkMedicationName("metformin")).toBeNull();
    expect(checkMedicationName("  METFORMIN ")).toBeNull();
    expect(checkMedicationName("Tylenol")).toBeNull();
    expect(checkMedicationName("Ramipril")).toBeNull();
  });
  it("does not flag names that are not close to anything on the list (brand names, new drugs)", () => {
    expect(checkMedicationName("Xarelto")).toBeNull();
    expect(checkMedicationName("Vitamin D")).toBeNull();
  });
  it("does not flag an empty name", () => {
    expect(checkMedicationName("")).toBeNull();
    expect(checkMedicationName("   ")).toBeNull();
  });
  it("the message names what was typed", () => {
    expect(checkMedicationName("meform")!.message).toContain("meform");
  });
});

describe("spec: the question and the pause rule", () => {
  it("words the question as in the feedback", () => {
    expect(nameConfirmationQuestion({ name: "meform" })).toBe("Are you sure about the medication's spelling?");
  });
  it("an unusual, unanswered name is waiting for an answer", () => {
    expect(isNameUnanswered({ name: "meform", dose: "500 mg", frequency: "twice a day" })).toBe(true);
  });
  it("a normal name is never waiting", () => {
    expect(isNameUnanswered({ name: "Metformin", dose: "500 mg", frequency: "twice a day" })).toBe(false);
    expect(isNameUnanswered({ name: "", dose: "", frequency: "" })).toBe(false);
  });
  it("Yes answers it, and only for that exact name", () => {
    expect(isNameConfirmed(asTyped("meform"))).toBe(true);
    expect(isNameUnanswered(asTyped("meform"))).toBe(false);
    expect(isNameConfirmed({ ...asTyped("meform"), name: "meformm" })).toBe(false); // edited after Yes: ask again
    expect(isNameUnanswered({ ...asTyped("meform"), name: "meformm" })).toBe(true);
  });
  it("No (the spelling is wrong) answers it too, so the person is never stuck, and only for that exact name", () => {
    const wrong = { name: "meform", dose: "", frequency: "", [NAME_WRONG_KEY]: "meform" };
    expect(isNameMarkedWrong(wrong)).toBe(true);
    expect(isNameConfirmed(wrong)).toBe(false);
    expect(isNameUnanswered(wrong)).toBe(false);
    expect(isNameUnanswered({ ...wrong, name: "meformm" })).toBe(true); // edited after No: ask again
  });
  it("fixing the name (clicking a suggestion) answers it", () => {
    expect(isNameCorrected(corrected("meform", "Metformin"))).toBe(true);
    expect(isNameUnanswered(corrected("meform", "Metformin"))).toBe(false);
  });
  it("a Yes on a name that is now normal is not a confirmation", () => {
    expect(isNameConfirmed({ name: "Metformin", dose: "", frequency: "", [NAME_CONFIRM_KEY]: "Metformin" })).toBe(false);
  });
  it("a fix that is itself still misspelt is not answered", () => {
    expect(isNameUnanswered(corrected("meform", "metfromin"))).toBe(true);
  });
  it("does not depend on the dose", () => {
    const r = { name: "meform", dose: "100 g/day", frequency: "once a day", [NAME_CONFIRM_KEY]: "meform" };
    expect(isNameUnanswered(r)).toBe(false);
  });
});

describe("spec: the outcome travels with the answer", () => {
  it("marks a name confirmed as typed", () => {
    expect(formatAnswer(q, { items: [asTyped("meform")] })).toBe(`meform, 500 mg, twice a day ${NAME_CONFIRMED_MARKER}`);
    expect(NAME_CONFIRMED_MARKER).toBe("(patient confirmed this spelling as typed)");
  });
  it("marks a corrected name with what was originally typed", () => {
    expect(formatAnswer(q, { items: [corrected("meform", "Metformin")] })).toBe(`Metformin, 500 mg, twice a day ${nameCorrectedMarker("meform")}`);
    expect(nameCorrectedMarker("meform")).toBe("(patient corrected from 'meform')");
  });
  it("marks a No (spelling is wrong) that was left uncorrected", () => {
    expect(formatAnswer(q, { items: [{ name: "meform", dose: "500 mg", frequency: "daily", [NAME_WRONG_KEY]: "meform" }] })).toBe(`meform, 500 mg, daily ${NAME_WRONG_MARKER}`);
    expect(NAME_WRONG_MARKER).toBe("(patient said this spelling is incorrect)");
  });
  it("does not mark an unanswered row or a normal name", () => {
    expect(formatAnswer(q, { items: [{ name: "meform", dose: "500 mg", frequency: "daily" }] })).not.toContain("patient");
    expect(formatAnswer(q, { items: [{ name: "Metformin", dose: "500 mg", frequency: "daily" }] })).toBe("Metformin, 500 mg, daily");
  });
  it("drops the mark when the name is edited after Yes", () => {
    expect(formatAnswer(q, { items: [{ ...asTyped("meform"), name: "meformm" }] })).not.toContain("patient confirmed");
  });
  it("only the checked row of several is marked", () => {
    const ans = formatAnswer(q, { items: [asTyped("meform"), { name: "Ramipril", dose: "10 mg", frequency: "daily" }] });
    expect(ans.split("; ")[1]).toBe("Ramipril, 10 mg, daily");
    expect(ans.match(/patient/g)).toHaveLength(1);
  });
  it("no dose mark is added any more, even for a large dose (dose check removed)", () => {
    const row = { name: "meform", dose: "100 g/day", frequency: "once a day", [NAME_CONFIRM_KEY]: "meform", doseConfirmed: "meform|100 g/day|once a day" };
    const ans = formatAnswer(q, { items: [row] });
    expect(ans).toBe(`meform, 100 g/day, once a day ${NAME_CONFIRMED_MARKER}`);
  });
});

describe("spec: AI summary and consultation note (whether or not the name was corrected)", () => {
  const typedItems = medItem([asTyped("meform")]);
  const fixedItems = medItem([corrected("meform", "Metformin")]);
  const meds = (s: ModelSummary) => s.sections.find((x) => x.heading === "Current medications")!;

  it("a name confirmed as typed gets one bullet and one flag", () => {
    const out = applyNameConfirmations(empty(), typedItems);
    expect(meds(out).bullets).toHaveLength(1);
    expect(meds(out).bullets[0].text).toContain("meform");
    expect(meds(out).bullets[0].text).toContain("Are you sure about the medication's spelling?");
    expect(meds(out).bullets[0].text).toContain("medication list");
    expect(meds(out).bullets[0].citations).toEqual(["med_list"]);
    expect(out.flagged.filter((f) => f.field_id === "med_list")).toHaveLength(1);
  });
  it("a No that was left uncorrected is reported as incorrect spelling", () => {
    const items = medItem([{ name: "meform", dose: "500 mg", frequency: "twice a day", [NAME_WRONG_KEY]: "meform" }]);
    const out = applyNameConfirmations(empty(), items);
    expect(meds(out).bullets).toHaveLength(1);
    expect(meds(out).bullets[0].text).toContain("meform");
    expect(meds(out).bullets[0].text).toContain("incorrect");
    expect(out.flagged.filter((f) => f.field_id === "med_list")).toHaveLength(1);
  });
  it("a corrected name is still reported, with the original and the new spelling", () => {
    const out = applyNameConfirmations(empty(), fixedItems);
    expect(meds(out).bullets).toHaveLength(1);
    expect(meds(out).bullets[0].text).toContain("meform");
    expect(meds(out).bullets[0].text).toContain("Metformin");
    expect(out.flagged.filter((f) => f.field_id === "med_list")).toHaveLength(1);
  });
  it("adds exactly one bullet and one flag per row, even if applied twice", () => {
    const out = applyNameConfirmations(applyNameConfirmations(empty(), typedItems), typedItems);
    expect(meds(out).bullets).toHaveLength(1);
    expect(out.flagged.filter((f) => f.field_id === "med_list")).toHaveLength(1);
  });
  it("adds one bullet per checked row", () => {
    const out = applyNameConfirmations(empty(), medItem([asTyped("meform"), corrected("ramipryl", "Ramipril", "10 mg", "daily")]));
    expect(meds(out).bullets).toHaveLength(2);
  });
  it("adds nothing when no name was flagged", () => {
    const out = applyNameConfirmations(empty(), medItem([{ name: "Ramipril", dose: "10 mg", frequency: "daily" }]));
    expect(out.sections).toHaveLength(0);
    expect(out.flagged).toHaveLength(0);
  });
  it("keeps an existing Current medications section and its bullets", () => {
    const base = empty();
    base.sections.push({ heading: "Current medications", bullets: [{ text: "Ramipril 10 mg daily", citations: ["med_list"] }] });
    const out = applyNameConfirmations(base, typedItems);
    expect(meds(out).bullets).toHaveLength(2);
    expect(meds(out).bullets[0].text).toBe("Ramipril 10 mg daily");
  });
  it("survives summary validation", () => {
    for (const items of [typedItems, fixedItems]) {
      const out = applyNameConfirmations(empty(), items);
      const { checked } = validateSummary(out, items.map((i) => ({ field_id: i.field_id, answer: i.answer })), ["med_list"]);
      expect(checked.sections[0].bullets).toHaveLength(1);
      expect(checked.flagged).toHaveLength(1);
    }
  });
  it("appears in the template fallback exactly once in Current medications", () => {
    const tpl = applyNameConfirmations(buildTemplateSummary(typedItems, []), typedItems);
    expect(meds(tpl).bullets.filter((b) => b.text.includes("Are you sure about the medication's spelling?"))).toHaveLength(1);
  });
  it("is copied into the clinic note's Current medications, without internal keys", () => {
    const note = noteFromSummary(applyNameConfirmations(empty(), typedItems) as never);
    expect(note.currentMedications).toContain("meform");
    expect(JSON.stringify(note)).not.toContain(NAME_CONFIRM_KEY);
    expect(JSON.stringify(note)).not.toContain(NAME_ORIGINAL_KEY);
  });
});
