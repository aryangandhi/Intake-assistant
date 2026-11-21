import type { RawItem } from "@/lib/answers";
import { DOSE_MISSING_MARKER, DOSE_UNIT_MISSING_MARKER, UNIT_MISSING_MARKER, stripMarkers } from "@/lib/medicationCheck";
import type { ModelSummary } from "./schema";

type Gap = { row: string; text: string };

/** Medication rows where the patient left the dose and/or the unit empty. */
export function doseGaps(items: RawItem[]): Gap[] {
  const med = items.find((i) => i.field_id === "med_list");
  if (!med?.answer) return [];
  const out: Gap[] = [];
  for (const raw of med.answer.split("; ")) {
    const what = raw.includes(DOSE_UNIT_MISSING_MARKER) ? "dose and unit" : raw.includes(DOSE_MISSING_MARKER) ? "dose" : raw.includes(UNIT_MISSING_MARKER) ? "unit" : "";
    if (!what) continue;
    const row = stripMarkers(raw);
    out.push({ row, text: `Patient did not enter the ${what} for this medication: ${row}. Please ask at the visit.` });
  }
  return out;
}

/**
 * Adds a "Current medications" bullet and a flagged item for each medication row with a missing dose or unit.
 * Done in code (not by the model) so the oncologist always sees it, and the model is never asked to guess a dose.
 */
export function applyDoseGaps<T extends ModelSummary>(summary: T, items: RawItem[]): T {
  const gaps = doseGaps(items);
  if (!gaps.length) return summary;
  const heading = "Current medications";
  let section = summary.sections.find((s) => s.heading === heading);
  if (!section) {
    section = { heading, bullets: [] };
    summary.sections.push(section);
  }
  for (const g of gaps) {
    if (section.bullets.some((b) => b.text === g.text)) continue; // already added
    section.bullets.push({ text: g.text, citations: ["med_list"] });
    summary.flagged.push({ field_id: "med_list", note: `Missing dose or unit: ${g.row}. Please confirm at the visit.` });
  }
  return summary;
}
