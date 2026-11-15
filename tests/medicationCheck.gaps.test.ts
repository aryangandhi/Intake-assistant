// RED tests (TDD): dose formats the current parser misreads. Each should flag an unusual dose
// but today returns null because the number or unit is read wrongly. Make these pass, then merge
// this file into medicationCheck.test.ts.
import { describe, expect, it } from "vitest";
import { checkMedication } from "@/lib/medicationCheck";

describe("dose formats the parser should understand", () => {
  it("reads thousands separators (10,000 mg is 10 g, not 0 mg)", () => {
    expect(checkMedication("Metformin", "10,000 mg", "once a day")).not.toBeNull();
  });
  it("reads spelled-out units (100 grams)", () => {
    expect(checkMedication("Metformin", "100 grams", "once a day")).not.toBeNull();
    expect(checkMedication("Metformin", "100000 milligrams", "once a day")).not.toBeNull();
  });
  it("multiplies tablet counts (2 x 500 mg four times a day is 4 g of metformin)", () => {
    expect(checkMedication("Metformin", "2 x 500 mg", "four times a day")).not.toBeNull();
    expect(checkMedication("Metformin", "2 tablets of 500 mg", "four times a day")).not.toBeNull();
  });
  it("does not flag the normal version of those formats", () => {
    expect(checkMedication("Metformin", "1,000 mg", "twice a day")).toBeNull();
    expect(checkMedication("Metformin", "2 x 500 mg", "twice a day")).toBeNull();
    expect(checkMedication("Metformin", "0.5 grams", "twice a day")).toBeNull();
  });
});
