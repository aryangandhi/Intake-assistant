import type { Question } from "@/config/intakeQuestions";
import { formatAnswer, type AnswerValue } from "@/lib/answers";

/** Answer options of a multiple-choice question, in the order they are shown. */
export function spokenOptions(q: Question): string[] {
  if (q.type === "yesno") return ["Yes", "No"];
  if (q.type === "single") return q.options || [];
  if (q.type === "multi") return q.optionGroups ? q.optionGroups.flatMap((g) => g.options) : q.options || [];
  return [];
}

/**
 * What read aloud says for a question: the label, the example (Listen button only) and every option.
 * Once the question has an answer, it says the label followed by "You responded <answer>." instead of the options.
 */
export function readAloudText(q: Question, opts: { includeExample?: boolean; answer?: AnswerValue } = {}): string {
  const parts = [q.label.replace(/[.?!]*$/, "") + (q.label.trim().endsWith("?") ? "?" : ".")];
  const answer = formatAnswer(q, opts.answer);
  if (answer) {
    parts.push(`You responded ${answer}.`);
    return parts.join(" ");
  }
  if (opts.includeExample && q.example) parts.push(q.example);
  const options = spokenOptions(q);
  if (options.length) parts.push(`The options are: ${options.join(", ")}.${q.type === "multi" ? " You can choose more than one." : ""}`);
  else if (q.type === "scale") parts.push("Choose a number from 0 to 10.");
  return parts.join(" ");
}
