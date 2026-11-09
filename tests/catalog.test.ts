import { describe, expect, it } from "vitest";
import { buildCatalogResult, CatalogBook } from "@/lib/catalog";

const books: CatalogBook[] = [
  { id: "1", title: "Orbit One", author: "A. Writer", publicationYear: 2001, description: null, coverColor: null, available: true, genres: ["Fiction", "Science Fiction"] },
  { id: "2", title: "Orbit Two", author: "B. Writer", publicationYear: 2002, description: null, coverColor: null, available: false, genres: ["Fiction", "Science Fiction"] },
  { id: "3", title: "Quiet House", author: "C. Writer", publicationYear: 2003, description: null, coverColor: null, available: true, genres: ["Fiction"] },
  { id: "4", title: "Far Star", author: "D. Writer", publicationYear: 2004, description: null, coverColor: null, available: true, genres: ["Science Fiction"] },
];

const run = (genres: string[], operation: "and" | "or" | "difference" | "xor", availability: "any" | "available" | "loaned" = "any") =>
  buildCatalogResult(books, { genres, operation, availability, text: "" });

describe("catalog query builder", () => {
  it("evaluates the worked set-theory examples", () => {
    const availableSciFi = run(["Science Fiction"], "and", "available");
    expect(availableSciFi.expression).toBe("S ∩ V");
    expect(availableSciFi.books.map(({ id }) => id)).toEqual(["1", "4"]);

    const union = run(["Fiction", "Science Fiction"], "or");
    expect(union.expression).toBe("F ∪ S");
    expect(union.books.map(({ id }) => id)).toEqual(["1", "2", "3", "4"]);

    const difference = run(["Fiction", "Science Fiction"], "difference");
    expect(difference.expression).toBe("F ∖ S");
    expect(difference.books.map(({ id }) => id)).toEqual(["3"]);

    const xor = run(["Fiction", "Science Fiction"], "xor");
    expect(xor.expression).toBe("F △ S");
    expect(xor.books.map(({ id }) => id)).toEqual(["3", "4"]);

    const onLoan = run([], "and", "loaned");
    expect(onLoan.expression).toBe("Vc");
    expect(onLoan.books.map(({ id }) => id)).toEqual(["2"]);
  });

  it("keeps the displayed expression aligned with the actual matching subset", () => {
    const result = run(["Fiction", "Science Fiction"], "or");
    expect(result.expression).toBe("F ∪ S");
    expect(result.books.map(({ id }) => id)).toEqual(["1", "2", "3", "4"]);
    expect(result.books.every((book) => books.some(({ id }) => id === book.id))).toBe(true);
  });

  it("requires exactly two sets for difference and symmetric difference", () => {
    expect(run(["Fiction"], "difference").error).toMatch(/requires exactly two genres/i);
    expect(run(["Fiction", "Science Fiction", "Fantasy"], "xor").books).toEqual([]);
  });

  it("applies title and author search as an additional filter", () => {
    const result = buildCatalogResult(books, {
      genres: ["Fiction", "Science Fiction"],
      operation: "or",
      availability: "any",
      text: "C. Writer",
    });
    expect(result.expression).toContain("∩ T(");
    expect(result.books.map(({ id }) => id)).toEqual(["3"]);
    const titleMatch = buildCatalogResult(books, {
      genres: ["Fiction"],
      operation: "and",
      availability: "any",
      text: "Quiet",
    });
    expect(titleMatch.books.map(({ id }) => id)).toEqual(["3"]);
  });
});
