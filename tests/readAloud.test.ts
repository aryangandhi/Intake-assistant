import { describe, expect, it } from "vitest";
import { readAloudText } from "@/lib/readAloud";
import type { Question } from "@/config/intakeQuestions";

describe("readAloudText", () => {
  it("reads every option of a single-choice question", () => {
    const q: Question = { id: "s", label: "What sex were you assigned at birth?", type: "single", options: ["Female", "Male", "Intersex", "Prefer not to say"] };
    expect(readAloudText(q)).toBe("What sex were you assigned at birth? The options are: Female, Male, Intersex, Prefer not to say.");
  });
  it("reads Yes and No for yes/no questions", () => {
    expect(readAloudText({ id: "y", label: "Are you pregnant?", type: "yesno" })).toContain("The options are: Yes, No.");
  });
  it("reads grouped multiple-choice options and says more than one can be chosen", () => {
    const q = { id: "m", label: "Have you had any of these?", type: "multi", optionGroups: [{ group: "A", options: ["Asthma"] }, { group: "B", options: ["Diabetes", "None of these"] }] } as Question;
    expect(readAloudText(q)).toBe("Have you had any of these? The options are: Asthma, Diabetes, None of these. You can choose more than one.");
  });
  it("adds the example only when asked and adds nothing for text questions", () => {
    const q: Question = { id: "t", label: "Language", type: "text", example: "Example: English" };
    expect(readAloudText(q)).toBe("Language.");
    expect(readAloudText(q, { includeExample: true })).toBe("Language. Example: English");
  });
});
