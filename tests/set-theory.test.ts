import { describe, expect, it } from "vitest";
import {
  cardinality,
  complement,
  difference,
  intersection,
  isSubset,
  symmetricDifference,
  union,
} from "@/lib/set-theory";

describe("set operations", () => {
  const a = new Set([1, 2, 3]);
  const b = new Set([3, 4]);

  it("calculates union and intersection", () => {
    expect(union(a, b)).toEqual(new Set([1, 2, 3, 4]));
    expect(intersection(a, b)).toEqual(new Set([3]));
  });

  it("calculates difference and symmetric difference", () => {
    expect(difference(a, b)).toEqual(new Set([1, 2]));
    expect(symmetricDifference(a, b)).toEqual(new Set([1, 2, 4]));
  });

  it("calculates complement, cardinality, and subset membership", () => {
    const universe = new Set([1, 2, 3, 4, 5]);
    expect(complement(universe, a)).toEqual(new Set([4, 5]));
    expect(cardinality(a)).toBe(3);
    expect(isSubset(a, universe)).toBe(true);
    expect(isSubset(b, a)).toBe(false);
  });
});
