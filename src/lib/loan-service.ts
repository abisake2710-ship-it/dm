import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export async function createLoan(input: {
  bookId: string;
  memberId: string;
  dueAt: Date;
}) {
  return prisma.$transaction(async (transaction) => {
    const book = await transaction.book.findUnique({ where: { id: input.bookId } });
    if (!book) throw new Error("Book not found.");
    if (!book.available) throw new Error("This book is already on loan.");
    const member = await transaction.member.findUnique({ where: { id: input.memberId } });
    if (!member) throw new Error("Member not found.");

    const activeLoan = await transaction.loan.findFirst({
      where: { bookId: input.bookId, returnedAt: null },
    });
    if (activeLoan) throw new Error("This book is already on loan.");

    const loan = await transaction.loan.create({
      data: { ...input },
      include: { book: true, member: true },
    });
    await transaction.book.update({
      where: { id: input.bookId },
      data: { available: false },
    });
    return loan;
  });
}

export async function returnLoan(id: string) {
  return prisma.$transaction(async (transaction) => {
    const loan = await transaction.loan.findUnique({ where: { id } });
    if (!loan) throw new Error("Loan not found.");
    if (loan.returnedAt) throw new Error("This loan has already been returned.");
    const now = new Date();
    const updated = await transaction.loan.updateMany({
      where: { id, returnedAt: null },
      data: { returnedAt: now },
    });
    if (updated.count !== 1) throw new Error("This loan has already been returned.");
    await transaction.book.update({
      where: { id: loan.bookId },
      data: { available: true },
    });
    return { ...loan, returnedAt: now };
  });
}

export function isUniqueConstraintError(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}
