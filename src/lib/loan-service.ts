import {
  createMemberLoan,
  DuplicateValueError,
  returnMemberLoan,
} from "@/lib/firestore";

export const createLoan = createMemberLoan;
export const returnLoan = returnMemberLoan;

export function isUniqueConstraintError(error: unknown): boolean {
  return error instanceof DuplicateValueError;
}
