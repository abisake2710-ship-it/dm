import { describe, expect, it } from "vitest";
import { bookSchema, genreSchema, loanSchema } from "@/lib/schemas";

describe("API input schemas", () => {
  it("rejects a book without a title or author", () => {
    expect(bookSchema.safeParse({ title: " ", author: "Author" }).success).toBe(false);
    expect(bookSchema.safeParse({ title: "Title", author: "" }).success).toBe(false);
  });

  it("accepts a valid book and rejects an invalid cover color", () => {
    expect(bookSchema.safeParse({ title: "Title", author: "Author", genreIds: [] }).success).toBe(true);
    expect(bookSchema.safeParse({ title: "Title", author: "Author", coverColor: "red" }).success).toBe(false);
  });

  it("validates genre names and future loan dates", () => {
    expect(genreSchema.safeParse({ name: " " }).success).toBe(false);
    expect(loanSchema.safeParse({
      bookId: "00000000-0000-4000-8000-000000000001",
      memberId: "00000000-0000-4000-8000-000000000002",
      dueAt: new Date(Date.now() - 60_000),
    }).success).toBe(false);
  });
});
