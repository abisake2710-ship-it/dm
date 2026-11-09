import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createLoan, returnLoan } from "@/lib/loan-service";
import { db } from "@/lib/realtime-database";

const memberId = crypto.randomUUID();
const bookId = crypto.randomUUID();

describe.skipIf(!process.env.FIREBASE_DATABASE_EMULATOR_HOST)("loan service", () => {
  beforeAll(async () => {
    await db.ref(`members/${memberId}`).set({
      id: memberId,
      name: "Test Member",
      email: `${crypto.randomUUID()}@example.test`,
      joinedAt: new Date(),
    });
    await db.ref(`books/${bookId}`).set({
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
    const loansSnapshot = await db.ref("loans").get();
    const loans = loansSnapshot.val() as Record<string, { bookId: string }> | null;
    const updates: Record<string, null> = {
      [`books/${bookId}`]: null,
      [`members/${memberId}`]: null,
    };
    for (const [id, loan] of Object.entries(loans ?? {})) {
      if (loan.bookId === bookId) updates[`loans/${id}`] = null;
    }
    await db.ref().update(updates);
  });

  it("synchronizes availability when a book is borrowed and returned", async () => {
    const loan = await createLoan({ bookId, memberId, dueAt: new Date(Date.now() + 86_400_000) });

    expect((await db.ref(`books/${bookId}`).get()).child("available").val()).toBe(false);
    await expect(createLoan({ bookId, memberId, dueAt: new Date(Date.now() + 86_400_000) }))
      .rejects.toThrow(/already on loan/i);

    await returnLoan(loan.id);
    expect((await db.ref(`books/${bookId}`).get()).child("available").val()).toBe(true);
    await expect(returnLoan(loan.id)).rejects.toThrow(/already been returned/i);
  });
});
