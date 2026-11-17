/**
 * Typing-mistake check for medication rows (see DECISIONS.md, "unusual medication check").
 * Not medical advice: it only spots doses that look like a slip, e.g. "100 g" for "100 mg".
 */

/** Typical maximum total per day, in mg, for some common medications. */
const MAX_DAILY_MG: Record<string, number> = {
  metformin: 3000,
  ramipril: 20,
  lisinopril: 80,
  amlodipine: 10,
  atorvastatin: 80,
  rosuvastatin: 40,
  metoprolol: 400,
  levothyroxine: 0.6,
  warfarin: 15,
  tamoxifen: 40,
  letrozole: 2.5,
  anastrozole: 1,
  acetaminophen: 4000,
  tylenol: 4000,
  ibuprofen: 3200,
  advil: 3200,
  aspirin: 4000,
  omeprazole: 80,
  prednisone: 100,
  furosemide: 600,
  gabapentin: 3600,
};

export type MedicationWarning = { message: string };


/** Reads "1,500", "1 500", "0,5" (decimal comma) and "0.5" as numbers. */
function parseNumber(raw: string): number {
  let t = raw.replace(/\s/g, "");
  if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(t)) t = t.replace(/,/g, ""); // thousands separators
  else t = t.replace(",", "."); // decimal comma
  return parseFloat(t);
}

const UNIT = "milligrams?|micrograms?|grams?|mcg|mg|µg|ug|g";
const unitMg = (u: string) => (u.startsWith("milli") ? 1 : u.startsWith("micro") || u === "mcg" || u === "µg" || u === "ug" ? 0.001 : u.startsWith("gram") || u === "g" ? 1000 : 1);

function parseDoseMg(dose: string): { mg: number; perDay: boolean } | null {
  const lower = dose.toLowerCase();
  const m = lower.match(new RegExp(`(\\d[\\d,. ]*\\d|\\d)\\s*(${UNIT})\\b`));
  if (!m) return null;
  // "2 x 500 mg", "2 tablets of 500 mg": multiply by the count in front.
  const count = lower.slice(0, m.index).match(/(\d+)\s*(?:x|×|tablets?|tabs?|capsules?|caps?|pills?)\s*(?:of\s*)?$/);
  const mult = count ? parseInt(count[1], 10) : 1;
  return { mg: parseNumber(m[1]) * unitMg(m[2]) * mult, perDay: /(\/|per|a|each)\s*day|daily total/.test(lower) };
}

const WORDS: Record<string, number> = { once: 1, one: 1, twice: 2, two: 2, three: 3, four: 4, five: 5, six: 6 };

/** Doses per day, or null when it cannot be read. */
function parseDosesPerDay(freq: string): number | null {
  const f = freq.toLowerCase();
  const every = f.match(/(?:every\s+|\bq\s?)(\d+(?:\.\d+)?)\s*(hours?|hrs?|h)\b/);
  if (every) return 24 / parseFloat(every[1]);
  const abbr = f.match(/\b(qd|od|bid|tid|qid)\b/);
  if (abbr) return { qd: 1, od: 1, bid: 2, tid: 3, qid: 4 }[abbr[1]]!;
  if (/week/.test(f)) return 1 / 7;
  const num = f.match(/(\d+)\s*(x|times)/);
  if (num) return parseInt(num[1], 10);
  const word = f.match(/\b(once|one|twice|two|three|four|five|six)\b/);
  if (word) return WORDS[word[1]];
  if (/\b(daily|day|morning|night|bedtime)\b/.test(f)) return 1;
  return null;
}

function fmtMg(mg: number) {
  return mg >= 1000 ? `${+(mg / 1000).toFixed(2)} g` : `${+mg.toFixed(3)} mg`;
}

export function checkMedication(name: string, dose: string, frequency: string): MedicationWarning | null {
  const d = parseDoseMg(dose || "");
  if (!d) return null;
  const perDay = parseDosesPerDay(frequency || "");
  const entered = `${dose.trim()}${frequency.trim() ? `, ${frequency.trim()}` : ""}`;

  if (perDay !== null && perDay > 12 && !d.perDay) {
    return { message: `You entered "${entered}", which is more than 12 doses a day.` };
  }
  if (d.mg >= 10000 && !d.perDay) {
    return { message: `You entered "${entered}". A single dose of 10 g or more is very unusual.` };
  }

  const key = Object.keys(MAX_DAILY_MG).find((k) => name.toLowerCase().includes(k));
  const dailyMg = d.perDay ? d.mg : d.mg * (perDay ?? 1);
  if (key && dailyMg > MAX_DAILY_MG[key]) {
    return {
      message: `You entered "${entered}" (about ${fmtMg(dailyMg)} a day). The usual maximum for ${name.trim()} is about ${fmtMg(MAX_DAILY_MG[key])} a day.`,
    };
  }
  if (!key && d.perDay && d.mg >= 10000) {
    return { message: `You entered "${entered}". That is a very large amount for one day.` };
  }
  return null;
}

/** Key on a medication row that holds the signature of the name/dose/frequency the person confirmed. */
export const CONFIRM_KEY = "doseConfirmed";
/** Appended to a confirmed row in the formatted answer, so the AI summary and clinic note can see it. */
export const CONFIRMED_MARKER = "(patient confirmed this unusual dose)";

type Row = Record<string, string>;

export const medSignature = (it: Row) => `${it.name || ""}|${it.dose || ""}|${it.frequency || ""}`;

/** True when the person said Yes to "Are you sure?" and has not changed the row since. */
export function isConfirmedUnusual(it: Row): boolean {
  return it[CONFIRM_KEY] === medSignature(it) && checkMedication(it.name || "", it.dose || "", it.frequency || "") !== null;
}

/** Key holding the signature of the name/dose/frequency the person said No to (dose is wrong) and left unchanged. */
export const DOSE_WRONG_KEY = "doseWrong";
/** Appended to a row whose unusual dose the person said was wrong but did not fix. */
export const DOSE_WRONG_MARKER = "(patient said this dose is incorrect)";

/** True when the person said No to "Are you sure?" and has not changed the row since. */
export function isDoseMarkedWrong(it: Row): boolean {
  return it[DOSE_WRONG_KEY] === medSignature(it) && checkMedication(it.name || "", it.dose || "", it.frequency || "") !== null;
}

/** True when the dose looks unusual and the person has not answered "Are you sure?" for it yet. */
export function isDoseUnanswered(it: Row): boolean {
  return checkMedication(it.name || "", it.dose || "", it.frequency || "") !== null && !isConfirmedUnusual(it) && !isDoseMarkedWrong(it);
}

/** "Are you sure about your dose of Metformin 100 g/day/once a day?" */
export function confirmationQuestion(it: Row): string {
  const dose = [it.dose?.trim(), it.frequency?.trim()].filter(Boolean).join("/");
  return `Are you sure about your dose of ${[it.name?.trim(), dose].filter(Boolean).join(" ")}?`;
}

/* ---------- Medication NAME spelling check (see DECISIONS.md, "unusual medication name check") ---------- */

/** Other common names to compare against, on top of the ones that have dose limits above. */
const EXTRA_NAMES = [
  "simvastatin", "pantoprazole", "hydrochlorothiazide", "losartan", "sertraline", "citalopram", "oxycodone", "morphine",
  "codeine", "tramadol", "ondansetron", "dexamethasone", "capecitabine", "insulin", "lorazepam", "clopidogrel",
  "apixaban", "salbutamol", "montelukast", "cetirizine", "loratadine", "naproxen", "diclofenac", "hydromorphone",
];
const KNOWN_NAMES = Array.from(new Set([...Object.keys(MAX_DAILY_MG), ...EXTRA_NAMES]));
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
  row.replace(CONFIRMED_MARKER, "").replace(DOSE_WRONG_MARKER, "").replace(NAME_CONFIRMED_MARKER, "").replace(NAME_WRONG_MARKER, "").replace(NAME_CORRECTED_PATTERN, "").replace(/\s+/g, " ").trim();

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
