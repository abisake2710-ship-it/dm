import {
  createMemberLoan,
  returnMemberLoan,
} from "@/lib/data";

export const createLoan = createMemberLoan;
export const returnLoan = returnMemberLoan;

export function isUniqueConstraintError(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.name === "DuplicateValueError" ||
      ("code" in error && error.code === "P2002"))
  );
}
