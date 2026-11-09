import { z } from "zod";

export const bookSchema = z.object({
  title: z.string().trim().min(1, "Title is required."),
  author: z.string().trim().min(1, "Author is required."),
  isbn: z.string().trim().optional().nullable(),
  publicationYear: z.number().int().min(1000).max(2100).optional().nullable(),
  description: z.string().trim().optional().nullable(),
  coverColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional().nullable(),
  genreIds: z.array(z.string().uuid()).default([]),
});

export const genreSchema = z.object({
  name: z.string().trim().min(1, "Genre name is required."),
  description: z.string().trim().optional().nullable(),
});

export const loanSchema = z.object({
  bookId: z.string().uuid(),
  memberId: z.string().uuid(),
  dueAt: z.coerce.date().refine((date) => date > new Date(), "Due date must be in the future."),
});

export const memberSchema = z.object({
  name: z.string().trim().min(1),
  email: z.string().email(),
});
