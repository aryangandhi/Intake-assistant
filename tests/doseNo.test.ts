// "No" on the unusual-dose question lets the person continue (DECISIONS.md, v3 unusual medication check).
import { describe, expect, it } from "vitest";
import { getQuestion } from "@/config/intakeQuestions";
import { formatAnswer, type RawItem } from "@/lib/answers";
import { applyDoseConfirmations } from "@/lib/ai/doseConfirmations";
import type { ModelSummary } from "@/lib/ai/schema";
import { CONFIRM_KEY, DOSE_WRONG_KEY, DOSE_WRONG_MARKER, isDoseMarkedWrong, isDoseUnanswered, medSignature } from "@/lib/medicationCheck";

const q = getQuestion("med_list")!;
const row = { name: "Metformin", dose: "100 g/day", frequency: "once a day" };

describe("unusual dose answered No", () => {
  it("an unanswered unusual dose pauses the form", () => {
    expect(isDoseUnanswered(row)).toBe(true);
  });
  it("No without fixing the dose no longer pauses the form", () => {
    const no = { ...row, [DOSE_WRONG_KEY]: medSignature(row) };
    expect(isDoseMarkedWrong(no)).toBe(true);
    expect(isDoseUnanswered(no)).toBe(false);
  });
  it("editing the row after No asks again", () => {
    const no = { ...row, [DOSE_WRONG_KEY]: medSignature(row), dose: "200 g/day" };
    expect(isDoseUnanswered(no)).toBe(true);
  });
  it("Yes still counts as answered and is not marked wrong", () => {
    const yes = { ...row, [CONFIRM_KEY]: medSignature(row) };
    expect(isDoseUnanswered(yes)).toBe(false);
    expect(isDoseMarkedWrong(yes)).toBe(false);
  });
  it("an uncorrected No is shown in the raw data and flagged for the oncologist, not confirmed", () => {
    const answer = formatAnswer(q, { items: [{ ...row, [DOSE_WRONG_KEY]: medSignature(row) }] });
    expect(answer).toBe(`Metformin, 100 g/day, once a day ${DOSE_WRONG_MARKER}`);
    const items: RawItem[] = [{ field_id: "med_list", section: "Current medications", question: q.label, answer, incomplete: false }];
    const out = applyDoseConfirmations<ModelSummary>({ paragraph: [], sections: [], flagged: [] }, items);
    expect(out.sections).toHaveLength(0);
    expect(out.flagged).toEqual([{ field_id: "med_list", note: "Patient said this dose is incorrect but did not correct it: Metformin, 100 g/day, once a day. Please confirm the dose at the visit." }]);
  });
});
