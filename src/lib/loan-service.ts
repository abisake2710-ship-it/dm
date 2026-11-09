import {
  createMemberLoan,
  DuplicateValueError,
  returnMemberLoan,
} from "@/lib/realtime-database";

export const createLoan = createMemberLoan;
export const returnLoan = returnMemberLoan;

export function isUniqueConstraintError(error: unknown): boolean {
  return error instanceof DuplicateValueError;
}
