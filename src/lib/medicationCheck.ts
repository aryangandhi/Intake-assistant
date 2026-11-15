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

const TO_MG: Record<string, number> = { mg: 1, g: 1000, mcg: 0.001, ug: 0.001, µg: 0.001 };

function parseDoseMg(dose: string): { mg: number; perDay: boolean } | null {
  const m = dose.toLowerCase().match(/(\d+(?:\.\d+)?)\s*(mg|mcg|µg|ug|g)\b/);
  if (!m) return null;
  return { mg: parseFloat(m[1]) * TO_MG[m[2]], perDay: /(\/|per|a|each)\s*day|daily total/.test(dose.toLowerCase()) };
}

const WORDS: Record<string, number> = { once: 1, one: 1, twice: 2, two: 2, three: 3, four: 4, five: 5, six: 6 };

/** Doses per day, or null when it cannot be read. */
function parseDosesPerDay(freq: string): number | null {
  const f = freq.toLowerCase();
  const every = f.match(/every\s+(\d+(?:\.\d+)?)\s*(hour|hr|h)\b/);
  if (every) return 24 / parseFloat(every[1]);
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

/** "Are you sure about your dose of Metformin 100 g/day/once a day?" */
export function confirmationQuestion(it: Row): string {
  const dose = [it.dose?.trim(), it.frequency?.trim()].filter(Boolean).join("/");
  return `Are you sure about your dose of ${[it.name?.trim(), dose].filter(Boolean).join(" ")}?`;
}
