import type { RawItem } from "@/lib/answers";
import { CONFIRMED_MARKER, stripMarkers } from "@/lib/medicationCheck";
import type { ModelSummary } from "./schema";

/** Medication rows (without the marker) that the patient confirmed as unusual doses. */
export function confirmedDoses(items: RawItem[]): string[] {
  const med = items.find((i) => i.field_id === "med_list");
  if (!med?.answer) return [];
  return med.answer
    .split("; ")
    .filter((r) => r.includes(CONFIRMED_MARKER))
    .map((r) => stripMarkers(r));
}

/**
 * Adds a "Current medications" bullet and a flagged item for each confirmed unusual dose.
 * Done in code (not by the model) so the oncologist always sees it.
 */
export function applyDoseConfirmations<T extends ModelSummary>(summary: T, items: RawItem[]): T {
  const doses = confirmedDoses(items);
  if (!doses.length) return summary;
  const heading = "Current medications";
  let section = summary.sections.find((s) => s.heading === heading);
  if (!section) {
    section = { heading, bullets: [] };
    summary.sections.push(section);
  }
  for (const d of doses) {
    if (section.bullets.some((b) => b.text.includes(`: ${d}.`) && b.text.includes("confirmed this dose as correct"))) continue; // already added
    section.bullets.push({ text: `Patient confirmed this dose as correct when asked "Are you sure?": ${d}. Please verify at the visit.`, citations: ["med_list"] });
    summary.flagged.push({ field_id: "med_list", note: `Unusual dose confirmed by patient: ${d}. Please verify.` });
  }
  return summary;
}
