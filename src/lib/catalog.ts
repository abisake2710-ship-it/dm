import {
  complement,
  difference,
  intersection,
  isSubset,
  symmetricDifference,
  union,
} from "@/lib/set-theory";

export type CatalogBook = {
  id: string;
  title: string;
  author: string;
  publicationYear: number | null;
  description: string | null;
  coverColor: string | null;
  available: boolean;
  genres: string[];
};

export type SetOperation = "and" | "or" | "difference" | "xor";
export type AvailabilityFilter = "any" | "available" | "loaned";

export type CatalogQuery = {
  genres: string[];
  operation: SetOperation;
  availability: AvailabilityFilter;
  text: string;
};

export type CatalogResult = {
  books: CatalogBook[];
  expression: string;
  explanation: string;
  error?: string;
  genreCounts: Array<{ name: string; symbol: string; count: number }>;
  intersectionCount: number | null;
  regions: { onlyA: CatalogBook[]; both: CatalogBook[]; onlyB: CatalogBook[] };
};

const symbols: Record<SetOperation, string> = {
  and: "∩",
  or: "∪",
  difference: "∖",
  xor: "△",
};

export function symbolForGenre(name: string, index: number): string {
  const known: Record<string, string> = {
    Fiction: "F",
    "Science Fiction": "S",
    Fantasy: "Fa",
    Mystery: "M",
    Horror: "H",
    "Historical Fiction": "HF",
    Romance: "R",
    Dystopian: "D",
    Adventure: "A",
    "Literary Fiction": "LF",
  };
  const abbreviation = name.split(/\s+/).map((part) => part[0]).join("").toUpperCase();
  return known[name] ?? (abbreviation || `G${index + 1}`);
}

function operationName(operation: SetOperation): string {
  return {
    and: "and",
    or: "or",
    difference: "but not",
    xor: "or, but not both",
  }[operation];
}

export function buildCatalogResult(universe: CatalogBook[], query: CatalogQuery): CatalogResult {
  const selectedGenres = [...new Set(query.genres)];
  const selectedSets = selectedGenres.map((name) =>
    new Set(universe.filter((book) => book.genres.includes(name)).map((book) => book.id)),
  );
  const genreCounts = selectedGenres.map((name, index) => ({
    name,
    symbol: symbolForGenre(name, index),
    count: selectedSets[index].size,
  }));
  const allIds = new Set(universe.map((book) => book.id));
  const availableIds = new Set(universe.filter((book) => book.available).map((book) => book.id));
  const normalizedText = query.text.trim().toLocaleLowerCase();
  const matchesAdditionalFilters = (book: CatalogBook) =>
    (query.availability === "any" ||
      (query.availability === "available" ? book.available : !book.available)) &&
    (!normalizedText ||
      book.title.toLocaleLowerCase().includes(normalizedText) ||
      book.author.toLocaleLowerCase().includes(normalizedText));
  let resultIds = new Set(allIds);
  let expression = "B";
  let explanation = "Every book in the library catalog.";
  let error: string | undefined;

  if ((query.operation === "difference" || query.operation === "xor") && selectedSets.length !== 2) {
    error = `${query.operation === "difference" ? "Difference" : "Symmetric difference"} requires exactly two genres. Select two genres to continue.`;
  } else if (selectedSets.length > 0) {
    resultIds = new Set(selectedSets[0]);
    for (let index = 1; index < selectedSets.length; index += 1) {
      const next = selectedSets[index];
      switch (query.operation) {
        case "and":
          resultIds = intersection(resultIds, next);
          break;
        case "or":
          resultIds = union(resultIds, next);
          break;
        case "difference":
          resultIds = difference(resultIds, next);
          break;
        case "xor":
          resultIds = symmetricDifference(resultIds, next);
          break;
      }
    }
    const genreSymbols = genreCounts.map(({ symbol }) => symbol);
    expression = genreSymbols.length === 1 ? genreSymbols[0] : genreSymbols.join(` ${symbols[query.operation]} `);
    const names = selectedGenres.map((name) => `“${name}”`).join(` ${operationName(query.operation)} `);
    explanation =
      selectedGenres.length === 1
        ? `Books in the ${names} set.`
        : `Books in ${names}.`;
  }

  if (query.availability === "available") {
    resultIds = intersection(resultIds, availableIds);
    expression =
      expression === "B"
        ? "V"
        : selectedGenres.length === 1
        ? `${expression} ∩ V`
        : `(${expression}) ∩ V`;
    explanation += ` ${selectedGenres.length ? "They are" : "Books are"} currently available.`;
  } else if (query.availability === "loaned") {
    resultIds = intersection(resultIds, complement(allIds, availableIds));
    expression =
      expression === "B"
        ? "Vc"
        : selectedGenres.length === 1
        ? `${expression} ∩ Vc`
        : `(${expression}) ∩ Vc`;
    explanation += ` ${selectedGenres.length ? "They are" : "Books are"} currently on loan.`;
  }

  if (error) {
    resultIds = new Set();
    const operator = symbols[query.operation];
    const selectedSymbols = genreCounts.map(({ symbol }) => symbol);
    expression = selectedSymbols.length === 1
      ? `${selectedSymbols[0]} ${operator} ?`
      : `A ${operator} B`;
  }
  const books = universe.filter(
    (book) =>
      resultIds.has(book.id) &&
      matchesAdditionalFilters(book),
  );
  if (normalizedText && !error) {
    expression += ` ∩ T(${JSON.stringify(query.text.trim())})`;
    explanation += ` Text match for “${query.text.trim()}” is applied as an additional filter.`;
  }

  const regions =
    selectedSets.length === 2
      ? {
          onlyA: universe.filter((book) => selectedSets[0].has(book.id) && !selectedSets[1].has(book.id) && matchesAdditionalFilters(book)),
          both: universe.filter((book) => selectedSets[0].has(book.id) && selectedSets[1].has(book.id) && matchesAdditionalFilters(book)),
          onlyB: universe.filter((book) => selectedSets[1].has(book.id) && !selectedSets[0].has(book.id) && matchesAdditionalFilters(book)),
        }
      : { onlyA: [], both: [], onlyB: [] };

  if (!isSubset(new Set(books.map((book) => book.id)), allIds)) {
    throw new Error("Catalog query returned an item outside the library universe.");
  }

  return {
    books,
    expression,
    explanation: error ?? explanation,
    error,
    genreCounts,
    intersectionCount:
      selectedSets.length === 2 ? intersection(selectedSets[0], selectedSets[1]).size : null,
    regions,
  };
}
