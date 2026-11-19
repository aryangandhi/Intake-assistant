import type { RawItem } from "@/lib/answers";
import { NAME_CONFIRMED_MARKER, NAME_CORRECTED_PATTERN, NAME_WRONG_MARKER, stripMarkers } from "@/lib/medicationCheck";
import type { ModelSummary } from "./schema";

type NameOutcome = { row: string; text: string };

const QUESTION = `Patient was asked "Are you sure about the medication's spelling?" and`;
const CHECK = "Please check against their medication list.";

/** Medication rows where the person answered the spelling question, whether or not they corrected the name. */
export function nameOutcomes(items: RawItem[]): NameOutcome[] {
  const med = items.find((i) => i.field_id === "med_list");
  if (!med?.answer) return [];
  const out: NameOutcome[] = [];
  for (const raw of med.answer.split("; ")) {
    const row = stripMarkers(raw);
    const name = row.split(", ")[0];
    const fixed = raw.match(NAME_CORRECTED_PATTERN);
    if (raw.includes(NAME_CONFIRMED_MARKER)) out.push({ row, text: `${QUESTION} confirmed "${name}" as typed: ${row}. ${CHECK}` });
    else if (raw.includes(NAME_WRONG_MARKER)) out.push({ row, text: `${QUESTION} said the spelling of "${name}" is incorrect and did not correct it: ${row}. ${CHECK}` });
    else if (fixed) out.push({ row, text: `${QUESTION} corrected "${fixed[1]}" to "${name}": ${row}. ${CHECK}` });
  }
  return out;
}

/**
 * Adds a "Current medications" bullet and a flagged item for each medication name the person was asked about.
 * Done in code (not by the model) so the oncologist always sees it.
 */
export function applyNameConfirmations<T extends ModelSummary>(summary: T, items: RawItem[]): T {
  const outcomes = nameOutcomes(items);
  if (!outcomes.length) return summary;
  const heading = "Current medications";
  let section = summary.sections.find((s) => s.heading === heading);
  if (!section) {
    section = { heading, bullets: [] };
    summary.sections.push(section);
  }
  for (const o of outcomes) {
    if (section.bullets.some((b) => b.text === o.text)) continue; // already added
    section.bullets.push({ text: o.text, citations: ["med_list"] });
    summary.flagged.push({ field_id: "med_list", note: `Medication name spelling checked with patient: ${o.row}. Please verify against their medication list.` });
  }
  return summary;
}
