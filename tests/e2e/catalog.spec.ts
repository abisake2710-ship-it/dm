import { expect, test } from "@playwright/test";

test("shows the library universe and catalog title", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /a library catalog/i })).toBeVisible();
  await expect(page.getByText("25 books in the universe")).toBeVisible();
  await expect(page.locator(".expression-equation")).toHaveText("B");
});

test("keeps the union expression consistent with books in the result subset", async ({ page, request }) => {
  const response = await request.get("/api/books");
  const books = await response.json() as Array<{ id: string; genres: string[] }>;
  const expected = new Set(books.filter((book) => book.genres.includes("Fiction") || book.genres.includes("Science Fiction")).map((book) => `/books/${book.id}`));

  await page.goto("/");
  await page.getByLabel("Fiction", { exact: true }).check();
  await page.getByLabel("Science Fiction", { exact: true }).check();
  await page.getByRole("combobox", { name: "Set operation" }).selectOption("or");

  await expect(page.locator(".expression-equation")).toHaveText("F ∪ S");
  const actual = await page.locator("a.book-card").evaluateAll((cards) => cards.map((card) => card.getAttribute("href") ?? ""));
  expect(new Set(actual)).toEqual(expected);
});

test("applies the on-loan complement filter", async ({ page, request }) => {
  const books = await (await request.get("/api/books")).json() as Array<{ id: string; available: boolean }>;
  const expected = new Set(books.filter((book) => !book.available).map((book) => `/books/${book.id}`));
  await page.goto("/");
  await page.getByLabel("On loan only").check();
  await expect(page.locator(".expression-equation")).toHaveText("Vc");
  const actual = await page.locator("a.book-card").evaluateAll((cards) => cards.map((card) => card.getAttribute("href") ?? ""));
  expect(new Set(actual)).toEqual(expected);
});
