import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createLoan, returnLoan } from "@/lib/loan-service";
import { db } from "@/lib/firestore";

const memberId = crypto.randomUUID();
const bookId = crypto.randomUUID();

describe.skipIf(!process.env.FIRESTORE_EMULATOR_HOST)("loan service", () => {
  beforeAll(async () => {
    await db.collection("members").doc(memberId).set({
      id: memberId,
      name: "Test Member",
      email: `${crypto.randomUUID()}@example.test`,
      joinedAt: new Date(),
    });
    await db.collection("books").doc(bookId).set({
      id: bookId,
      title: "Service Test Book",
      author: "Test Author",
      available: true,
      genreIds: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  });

  afterAll(async () => {
    const loans = await db.collection("loans").where("bookId", "==", bookId).get();
    const batch = db.batch();
    for (const loan of loans.docs) batch.delete(loan.ref);
    batch.delete(db.collection("books").doc(bookId));
    batch.delete(db.collection("members").doc(memberId));
    await batch.commit();
  });

  it("synchronizes availability when a book is borrowed and returned", async () => {
    const loan = await createLoan({ bookId, memberId, dueAt: new Date(Date.now() + 86_400_000) });

    expect((await db.collection("books").doc(bookId).get()).get("available")).toBe(false);
    await expect(createLoan({ bookId, memberId, dueAt: new Date(Date.now() + 86_400_000) }))
      .rejects.toThrow(/already on loan/i);

    await returnLoan(loan.id);
    expect((await db.collection("books").doc(bookId).get()).get("available")).toBe(true);
    await expect(returnLoan(loan.id)).rejects.toThrow(/already been returned/i);
  });
});
