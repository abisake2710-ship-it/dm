import { afterAll, describe, expect, it } from "vitest";
import { createLoan, returnLoan } from "@/lib/loan-service";
import { prisma } from "@/lib/prisma";

const suffix = crypto.randomUUID();
const memberId = crypto.randomUUID();
const bookId = crypto.randomUUID();

describe("loan service", () => {
  afterAll(async () => {
    await prisma.loan.deleteMany({ where: { bookId } });
    await prisma.book.deleteMany({ where: { id: bookId } });
    await prisma.member.deleteMany({ where: { id: memberId } });
    await prisma.$disconnect();
  });

  it("synchronizes availability when a book is borrowed and returned", async () => {
    await prisma.member.create({ data: { id: memberId, name: "Test Member", email: `${suffix}@example.test` } });
    await prisma.book.create({ data: { id: bookId, title: "Service Test Book", author: "Test Author", available: true } });
    const loan = await createLoan({ bookId, memberId, dueAt: new Date(Date.now() + 86_400_000) });

    expect((await prisma.book.findUniqueOrThrow({ where: { id: bookId } })).available).toBe(false);
    await expect(createLoan({ bookId, memberId, dueAt: new Date(Date.now() + 86_400_000) }))
      .rejects.toThrow(/already on loan/i);

    await returnLoan(loan.id);
    expect((await prisma.book.findUniqueOrThrow({ where: { id: bookId } })).available).toBe(true);
    await expect(returnLoan(loan.id)).rejects.toThrow(/already been returned/i);
  });
});
