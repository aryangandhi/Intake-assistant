/**
 * Medication row checks: a missing dose or unit, and medication names that look misspelt
 * (see DECISIONS.md). Not medical advice.
 */

/**
 * Common medication names the spelling check compares against. These used to carry daily dose limits for an
 * "Are you sure about your dose?" check, which was removed (see DECISIONS.md, "unusual medication check removed").
 */
const COMMON_NAMES = [
  "metformin", "ramipril", "lisinopril", "amlodipine", "atorvastatin", "rosuvastatin", "metoprolol", "levothyroxine",
  "warfarin", "tamoxifen", "letrozole", "anastrozole", "acetaminophen", "tylenol", "ibuprofen", "advil", "aspirin",
  "omeprazole", "prednisone", "furosemide", "gabapentin",
];

type Row = Record<string, string>;

/** The dose as one piece of text: the number and the unit together ("500 mg"). Rows saved before the split have the unit inside the dose. */
export const doseText = (it: Row) => [it.dose, it.unit].map((x) => (x || "").trim()).filter(Boolean).join(" ");

/** Appended to a row in the formatted answer when the person left the dose and/or the unit empty. */
export const DOSE_MISSING_MARKER = "(dose missing)";
export const UNIT_MISSING_MARKER = "(unit missing)";
export const DOSE_UNIT_MISSING_MARKER = "(dose and unit missing)";

/** What is missing from a row that has a medication name: the dose number, the unit, or both. */
export function missingDoseParts(it: Row): { dose: boolean; unit: boolean } {
  if (!(it.name || "").trim()) return { dose: false, unit: false };
  const dose = (it.dose || "").trim();
  const unit = (it.unit || "").trim();
  // Rows saved before the split have the unit typed inside the dose ("500 mg"): that is not a missing unit.
  return { dose: !dose, unit: !unit && !(dose && /[a-zµ]/i.test(dose)) };
}

/** True when the row has a medication name but no dose number or no unit. */
export const isDoseIncomplete = (it: Row) => {
  const m = missingDoseParts(it);
  return m.dose || m.unit;
};

export function missingMarker(it: Row): string {
  const m = missingDoseParts(it);
  return m.dose && m.unit ? DOSE_UNIT_MISSING_MARKER : m.dose ? DOSE_MISSING_MARKER : m.unit ? UNIT_MISSING_MARKER : "";
}

/** "Please add the dose", "Please choose a unit" or both. */
export function missingDoseNotice(it: Row): string {
  const m = missingDoseParts(it);
  return m.dose && m.unit ? "Please add the dose and choose a unit" : m.dose ? "Please add the dose" : m.unit ? "Please choose a unit" : "";
}

/* ---------- Medication NAME spelling check (see DECISIONS.md, "unusual medication name check") ---------- */

/** More common names to compare against. */
const EXTRA_NAMES = [
  "simvastatin", "pantoprazole", "hydrochlorothiazide", "losartan", "sertraline", "citalopram", "oxycodone", "morphine",
  "codeine", "tramadol", "ondansetron", "dexamethasone", "capecitabine", "insulin", "lorazepam", "clopidogrel",
  "apixaban", "salbutamol", "montelukast", "cetirizine", "loratadine", "naproxen", "diclofenac", "hydromorphone",
];
const KNOWN_NAMES = Array.from(new Set([...COMMON_NAMES, ...EXTRA_NAMES]));
const properCase = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Edit distance counting a swap of two neighbouring letters as one edit. */
function editDistance(a: string, b: string): number {
  const d: number[][] = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 0; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
    }
  }
  return d[a.length][b.length];
}

export type NameWarning = { message: string; suggestions: string[] };

/**
 * A name is unusual when it is not on the list but is close to a name that is (same first letter, a few letters
 * off). Names far from everything on the list (brand names, new drugs, "Vitamin D") are not flagged.
 */
export function checkMedicationName(name: string): NameWarning | null {
  const typed = (name || "").trim().toLowerCase();
  if (typed.length < 3 || KNOWN_NAMES.includes(typed)) return null;
  const close = KNOWN_NAMES.map((k) => ({ k, dist: editDistance(typed, k) }))
    .filter(({ k, dist }) => k[0] === typed[0] && dist <= Math.floor(k.length * 0.35) && dist <= Math.ceil(typed.length / 2))
    .sort((x, y) => x.dist - y.dist || x.k.localeCompare(y.k))
    .slice(0, 3)
    .map(({ k }) => properCase(k));
  if (!close.length) return null;
  return { message: `You entered "${name.trim()}", which we could not find as a medication name.`, suggestions: close };
}

/** Row keys: the exact name the person said Yes to / said was wrong, and the unusual text a fix replaced. */
export const NAME_CONFIRM_KEY = "nameConfirmed";
export const NAME_WRONG_KEY = "nameWrong";
export const NAME_ORIGINAL_KEY = "nameOriginal";
/** Appended to the formatted answer, so the AI summary and clinic note can see the outcome. */
export const NAME_CONFIRMED_MARKER = "(patient confirmed this spelling as typed)";
export const NAME_WRONG_MARKER = "(patient said this spelling is incorrect)";
export const nameCorrectedMarker = (original: string) => `(patient corrected from '${original}')`;
export const NAME_CORRECTED_PATTERN = /\(patient corrected from '([^']*)'\)/;

/** Removes every "(patient …)" marker from a formatted medication row. */
export const stripMarkers = (row: string) =>
  row.replace(DOSE_UNIT_MISSING_MARKER, "").replace(DOSE_MISSING_MARKER, "").replace(UNIT_MISSING_MARKER, "").replace(NAME_CONFIRMED_MARKER, "").replace(NAME_WRONG_MARKER, "").replace(NAME_CORRECTED_PATTERN, "").replace(/\s+/g, " ").trim();

const unusualName = (it: Row) => checkMedicationName(it.name || "") !== null;

/** True when the person said Yes (spelling is correct as typed) and has not changed the name since. */
export const isNameConfirmed = (it: Row) => unusualName(it) && it[NAME_CONFIRM_KEY] === it.name;
/** True when the person said No (spelling is wrong) and has not changed the name since. */
export const isNameMarkedWrong = (it: Row) => unusualName(it) && it[NAME_WRONG_KEY] === it.name;
/** True when an unusual name was replaced by a properly spelt one. */
export const isNameCorrected = (it: Row) =>
  !!it[NAME_ORIGINAL_KEY] && it[NAME_ORIGINAL_KEY].trim().toLowerCase() !== (it.name || "").trim().toLowerCase() && !unusualName(it);
/** True when the name looks unusual and the person has not answered "Are you sure about the medication's spelling?" yet. */
export const isNameUnanswered = (it: Row) => unusualName(it) && !isNameConfirmed(it) && !isNameMarkedWrong(it);

export const nameConfirmationQuestion = (_it: Row) => "Are you sure about the medication's spelling?";
