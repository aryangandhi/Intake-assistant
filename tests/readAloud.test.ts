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

describe("readAloudText with an answer", () => {
  it("re-reads a text question then says what was typed", () => {
    const q: Question = { id: "t", label: "What name would you like us to call you?", type: "text", example: "Example: Jane" };
    expect(readAloudText(q, { includeExample: true, answer: "Jane Doe" })).toBe("What name would you like us to call you? You responded Jane Doe.");
  });
  it("says the selected option instead of listing all options", () => {
    const q: Question = { id: "s", label: "What sex were you assigned at birth?", type: "single", options: ["Female", "Male"] };
    expect(readAloudText(q, { answer: "Female" })).toBe("What sex were you assigned at birth? You responded Female.");
  });
  it("joins multiple selections with 'and' and ignores blank answers", () => {
    const q = { id: "m", label: "Any of these?", type: "multi", options: ["A", "B"] } as Question;
    expect(readAloudText(q, { answer: ["A", "B"] })).toBe("Any of these? You responded A and B.");
    expect(readAloudText(q, { answer: [] })).toContain("The options are");
    expect(readAloudText({ id: "t", label: "Name", type: "text" }, { answer: "  " })).toBe("Name.");
  });
});

describe("readAloudText with an answer: edge cases", () => {
  const name: Question = { id: "t", label: "What name would you like us to call you?", type: "text" };

  it("does not double the full stop when the answer already ends in punctuation", () => {
    expect(readAloudText(name, { answer: "Jane Jr." })).toBe("What name would you like us to call you? You responded Jane Jr.");
  });
  it("does not add a full stop after an answer ending in ? or !", () => {
    expect(readAloudText(name, { answer: "Why?" })).toBe("What name would you like us to call you? You responded Why?");
  });
  it("collapses line breaks and repeated spaces in a long text answer", () => {
    const q: Question = { id: "n", label: "Anything else we should know?", type: "text" };
    expect(readAloudText(q, { answer: "Allergic to penicillin.\n\n  Also   latex" })).toBe(
      "Anything else we should know? You responded Allergic to penicillin. Also latex.",
    );
  });
  it("reads the last multiple-selection with 'and'", () => {
    const q = { id: "m", label: "Any of these?", type: "multi", options: ["Asthma", "Diabetes", "Gout"] } as Question;
    expect(readAloudText(q, { answer: ["Asthma", "Diabetes", "Gout"] })).toBe("Any of these? You responded Asthma, Diabetes and Gout.");
  });
});
