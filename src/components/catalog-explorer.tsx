"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { buildCatalogResult, CatalogBook, SetOperation, symbolForGenre } from "@/lib/catalog";

type Props = {
  books: CatalogBook[];
  genres: string[];
};

const operations: Array<{ value: SetOperation; label: string; symbol: string; name: string; desc: string }> = [
  { value: "and", label: "Intersection · AND", symbol: "∩", name: "AND Overlap", desc: "Must match ALL selected genres" },
  { value: "or", label: "Union · OR", symbol: "∪", name: "OR Combine", desc: "Matches ANY of the selected genres" },
  { value: "difference", label: "Difference · A but not B", symbol: "∖", name: "Exclude (A ∖ B)", desc: "In 1st genre, but NOT in 2nd" },
  { value: "xor", label: "Symmetric difference · XOR", symbol: "△", name: "XOR Distinct", desc: "In exactly ONE genre, not both" },
];

function VennDiagram({
  onlyA,
  both,
  onlyB,
  names,
  operation,
  counts,
  intersectionCount,
  onSelectRegion,
  activeRegion,
}: {
  onlyA: CatalogBook[];
  both: CatalogBook[];
  onlyB: CatalogBook[];
  names: string[];
  operation: SetOperation;
  counts: Array<{ name: string; symbol: string; count: number }>;
  intersectionCount: number | null;
  onSelectRegion?: (region: "onlyA" | "both" | "onlyB" | null) => void;
  activeRegion?: "onlyA" | "both" | "onlyB" | null;
}) {
  const aName = names[0] ?? "Set A";
  const bName = names[1] ?? "Set B";
  const aOnlyActive = operation === "difference" || operation === "xor" || operation === "or";
  const bOnlyActive = operation === "xor" || operation === "or";
  const bothActive = operation === "and" || operation === "or";

  return (
    <div className="venn-wrap">
      <svg className="venn" viewBox="0 0 360 210" role="img" aria-label={`Venn diagram: ${aName} and ${bName}`}>
        <defs>
          <clipPath id="vennLeft">
            <circle cx="142" cy="106" r="73" />
          </clipPath>
          <mask id="vennOnlyA" maskUnits="userSpaceOnUse" x="0" y="0" width="360" height="210">
            <rect width="360" height="210" fill="white" />
            <circle cx="218" cy="106" r="73" fill="black" />
          </mask>
          <mask id="vennOnlyB" maskUnits="userSpaceOnUse" x="0" y="0" width="360" height="210">
            <rect width="360" height="210" fill="white" />
            <circle cx="142" cy="106" r="73" fill="black" />
          </mask>
          <linearGradient id="gradA" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#0d9488" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#0f766e" stopOpacity="0.1" />
          </linearGradient>
          <linearGradient id="gradB" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#d97706" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#b45309" stopOpacity="0.1" />
          </linearGradient>
        </defs>
        
        {/* Circle A */}
        <circle
          className="venn-circle"
          cx="142"
          cy="106"
          r="73"
          onClick={() => onSelectRegion?.(activeRegion === "onlyA" ? null : "onlyA")}
        />
        {/* Circle B */}
        <circle
          className="venn-circle"
          cx="218"
          cy="106"
          r="73"
          onClick={() => onSelectRegion?.(activeRegion === "onlyB" ? null : "onlyB")}
        />
        {aOnlyActive && (
          <circle className="venn-region venn-a-region" cx="142" cy="106" r="73" mask="url(#vennOnlyA)" />
        )}
        {bOnlyActive && (
          <circle className="venn-region venn-b-region" cx="218" cy="106" r="73" mask="url(#vennOnlyB)" />
        )}
        {/* Overlap Lens */}
        <circle
          className={`venn-overlap ${bothActive ? "venn-overlap-active" : ""}`}
          cx="218"
          cy="106"
          r="73"
          clipPath="url(#vennLeft)"
          onClick={() => onSelectRegion?.(activeRegion === "both" ? null : "both")}
        />

        <text x="104" y="44" className="venn-label">{aName}</text>
        <text x="256" y="44" className="venn-label">{bName}</text>
        
        <text x="112" y="112" className="venn-count">
          <title>{`A only: ${onlyA.map((book) => book.title).join(", ") || "none"}`}</title>
          {onlyA.length}
        </text>
        <text x="180" y="112" className="venn-count">
          <title>{`Both: ${both.map((book) => book.title).join(", ") || "none"}`}</title>
          {both.length}
        </text>
        <text x="249" y="112" className="venn-count">
          <title>{`B only: ${onlyB.map((book) => book.title).join(", ") || "none"}`}</title>
          {onlyB.length}
        </text>
      </svg>

      <div className="region-list" aria-label="Venn diagram regions">
        <button type="button" className={`region-item ${activeRegion === "onlyA" ? "region-item-active" : ""}`} aria-pressed={activeRegion === "onlyA"} onClick={() => onSelectRegion?.(activeRegion === "onlyA" ? null : "onlyA")}>
          <div className="region-item-left">
            <span className="region-dot" />
            <span>{aName} only</span>
          </div>
          <strong>{onlyA.length}</strong>
        </button>
        <button type="button" className={`region-item ${activeRegion === "both" ? "region-item-active" : ""}`} aria-pressed={activeRegion === "both"} onClick={() => onSelectRegion?.(activeRegion === "both" ? null : "both")}>
          <div className="region-item-left">
            <span className="region-dot dot-both" />
            <span>Both ({names.join(" ∩ ")})</span>
          </div>
          <strong>{both.length}</strong>
        </button>
        <button type="button" className={`region-item ${activeRegion === "onlyB" ? "region-item-active" : ""}`} aria-pressed={activeRegion === "onlyB"} onClick={() => onSelectRegion?.(activeRegion === "onlyB" ? null : "onlyB")}>
          <div className="region-item-left">
            <span className="region-dot dot-b" />
            <span>{bName} only</span>
          </div>
          <strong>{onlyB.length}</strong>
        </button>
      </div>

      <p className="diagram-hint">
        Hover or select a region to view its book titles. Counts update with availability and text filters.
      </p>

      <div className="venn-math">
        <p>
          {counts.map(({ symbol, count }) => (
            <span key={symbol}>|{symbol}| = {count}</span>
          ))}
          <span>|A ∩ B| = {intersectionCount ?? 0}</span>
        </p>
        {operation === "or" && (
          <small>Inclusion–Exclusion Principle: |A ∪ B| = |A| + |B| − |A ∩ B|</small>
        )}
      </div>
    </div>
  );
}

export function CatalogExplorer({ books, genres }: Props) {
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [operation, setOperation] = useState<SetOperation>("and");
  const [availability, setAvailability] = useState<"any" | "available" | "loaned">("any");
  const [text, setText] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [sortBy, setSortBy] = useState<"title-asc" | "title-desc" | "year-desc" | "year-asc" | "available">("title-asc");
  const [showGuide, setShowGuide] = useState(false);
  const [selectedRegion, setSelectedRegion] = useState<"onlyA" | "both" | "onlyB" | null>(null);

  const searchInputRef = useRef<HTMLInputElement>(null);

  // Keyboard shortcut: Cmd/Ctrl + K to focus search
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key === "k") {
        event.preventDefault();
        searchInputRef.current?.focus();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Precompute book counts per genre for badges
  const genreCountsMap = useMemo(() => {
    const map: Record<string, number> = {};
    for (const genre of genres) {
      map[genre] = books.filter((b) => b.genres.includes(genre)).length;
    }
    return map;
  }, [books, genres]);

  const rawResult = useMemo(
    () => buildCatalogResult(books, { genres: selectedGenres, operation, availability, text }),
    [books, selectedGenres, operation, availability, text],
  );

  // If a Venn region is specifically clicked, filter the books list
  const filteredBooks = useMemo(() => {
    let list = rawResult.books;
    if (selectedRegion && selectedGenres.length === 2) {
      const regionBooks = rawResult.regions[selectedRegion];
      const regionIds = new Set(regionBooks.map((b) => b.id));
      list = list.filter((b) => regionIds.has(b.id));
    }

    // Apply sorting
    const sorted = [...list];
    switch (sortBy) {
      case "title-asc":
        sorted.sort((a, b) => a.title.localeCompare(b.title));
        break;
      case "title-desc":
        sorted.sort((a, b) => b.title.localeCompare(a.title));
        break;
      case "year-desc":
        sorted.sort((a, b) => (b.publicationYear ?? 0) - (a.publicationYear ?? 0));
        break;
      case "year-asc":
        sorted.sort((a, b) => (a.publicationYear ?? 9999) - (b.publicationYear ?? 9999));
        break;
      case "available":
        sorted.sort((a, b) => Number(b.available) - Number(a.available));
        break;
    }
    return sorted;
  }, [rawResult.books, rawResult.regions, selectedRegion, selectedGenres.length, sortBy]);

  function toggleGenre(name: string) {
    setSelectedRegion(null);
    setSelectedGenres((current) =>
      current.includes(name) ? current.filter((genre) => genre !== name) : [...current, name],
    );
  }

  function resetAllFilters() {
    setSelectedGenres([]);
    setOperation("and");
    setAvailability("any");
    setText("");
    setSelectedRegion(null);
  }

  // Active filter count for badges
  const activeFiltersCount =
    selectedGenres.length +
    (availability !== "any" ? 1 : 0) +
    (text.trim() ? 1 : 0) +
    (operation !== "and" && selectedGenres.length > 1 ? 1 : 0);
  const regionExpression =
    selectedRegion && selectedGenres.length === 2
      ? selectedRegion === "onlyA"
        ? `${symbolForGenre(selectedGenres[0], 0)} ∖ ${symbolForGenre(selectedGenres[1], 1)}`
        : selectedRegion === "onlyB"
          ? `${symbolForGenre(selectedGenres[1], 1)} ∖ ${symbolForGenre(selectedGenres[0], 0)}`
          : `${symbolForGenre(selectedGenres[0], 0)} ∩ ${symbolForGenre(selectedGenres[1], 1)}`
      : null;
  const resultExpression = regionExpression
    ? `(${rawResult.expression}) ∩ (${regionExpression})`
    : rawResult.expression;
  const resultExplanation = regionExpression
    ? `${rawResult.explanation} Limited to the selected ${selectedRegion === "both" ? "shared" : "exclusive"} Venn region.`
    : rawResult.explanation;

  return (
    <main className="page-shell">
      {/* Site Header */}
      <header className="site-header">
        <Link href="/" className="brand-lockup" aria-label="SetLib home">
          <span className="brand-mark" aria-hidden="true">
            S<span>∩</span>B
          </span>
          <div className="brand-info">
            <strong>SetLib</strong>
            <small>THE OPEN-STACK CATALOG</small>
          </div>
        </Link>

        <div className="header-center-pill" aria-hidden="true">
          <span className="header-pulse-dot" />
          <span>Universe <b>B</b> · {books.length} Active Titles</span>
        </div>

        <nav className="top-nav" aria-label="Main navigation">
          <a className="nav-link nav-active" href="#catalog">
            Catalog
          </a>
          <button
            type="button"
            className="nav-link"
            onClick={() => setShowGuide(true)}
            aria-label="Open how it works guide"
          >
            How it works
          </button>
          <Link href="/admin" className="nav-librarian-btn">
            Librarian desk <span aria-hidden="true">↗</span>
          </Link>
        </nav>
      </header>

      {/* Hero Section */}
      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">
            <span className="eyebrow-line" /> A DIFFERENT WAY TO DISCOVER
          </p>
          <h1>
            A Library Catalog<br />
            Built on <em>Set Theory.</em>
          </h1>
          <p className="hero-description">
            Every book belongs to a universe. Every search is a set. Find the stories where genres overlap, exclude tropes you dislike, and explore our collection with mathematical elegance.
          </p>

          {/* Quick-Discovery Preset Chips for Patrons */}
          <div className="preset-bar">
            <span className="preset-title">Quick discovery presets</span>
            <div className="preset-chips">
              <button
                type="button"
                className="preset-chip"
                onClick={() => {
                  setSelectedGenres(["Fiction", "Science Fiction"]);
                  setOperation("or");
                  setAvailability("any");
                }}
              >
                Sci-Fi & Fiction <code>F ∪ S</code>
              </button>
              <button
                type="button"
                className="preset-chip"
                onClick={() => {
                  setSelectedGenres(["Fiction", "Science Fiction"]);
                  setOperation("and");
                  setAvailability("available");
                }}
              >
                Available crossovers <code>(F ∩ S) ∩ V</code>
              </button>
              <button
                type="button"
                className="preset-chip"
                onClick={() => {
                  setSelectedGenres([]);
                  setOperation("and");
                  setAvailability("available");
                }}
              >
                Available on shelf <code>V</code>
              </button>
              <button
                type="button"
                className="preset-chip"
                onClick={() => {
                  setSelectedGenres(["Fiction", "Science Fiction"]);
                  setOperation("difference");
                }}
              >
                Fiction without Sci-Fi <code>F ∖ S</code>
              </button>
            </div>
          </div>
        </div>

        {/* Hero Interactive Art Card */}
        <div className="hero-art-container" aria-hidden="true">
          <div className="hero-art-card">
            <div className="hero-art-header">
              <span>SET THEORY VISUALIZER</span>
              <span className="hero-art-badge">REAL-TIME LOGIC</span>
            </div>
            <svg className="hero-venn-svg" viewBox="0 0 320 180">
              <defs>
                <clipPath id="heroOverlapClip">
                  <circle cx="125" cy="90" r="62" />
                </clipPath>
              </defs>
              <circle className="hero-circle-a" cx="125" cy="90" r="62" />
              <circle className="hero-circle-b" cx="195" cy="90" r="62" />
              <circle className="hero-circle-overlap" cx="195" cy="90" r="62" clipPath="url(#heroOverlapClip)" />
              <text x="95" y="42" fill="#0d9488" fontSize="12" fontWeight="700" fontFamily="sans-serif">
                FICTION (F)
              </text>
              <text x="225" y="42" fill="#d97706" fontSize="12" fontWeight="700" fontFamily="sans-serif">
                SCI-FI (S)
              </text>
              <text x="160" y="96" fill="#ffffff" fontSize="18" fontStyle="italic" fontFamily="Georgia, serif" textAnchor="middle">
                F ∩ S
              </text>
            </svg>
            <div className="hero-art-footer">
              <div className="hero-art-footer-col">
                <span>Universe</span>
                <strong>25 Books</strong>
              </div>
              <div className="hero-art-footer-col">
                <span>Overlap</span>
                <strong>Crossovers</strong>
              </div>
              <div className="hero-art-footer-col">
                <span>Availability</span>
                <strong>Live Sync</strong>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Main Catalog Section */}
      <section className="catalog-layout" id="catalog">
        {/* Left Sidebar / Filter Rail */}
        <aside className="filter-rail" aria-label="Catalog filters">
          <div className="filter-section-header">
            <div className="section-kicker">
              <span>01</span> DEFINE YOUR SET
            </div>
            {activeFiltersCount > 0 && (
              <button
                type="button"
                className="genre-quick-btn"
                onClick={resetAllFilters}
                title="Reset all filters"
              >
                Reset ({activeFiltersCount})
              </button>
            )}
          </div>

          {/* Search Field */}
          <div className="search-box-wrap">
            <label className="search-label" htmlFor="catalog-search">
              Search by title or author
            </label>
            <div className="search-field">
              <span className="search-field-icon" aria-hidden="true">
                ⌕
              </span>
              <input
                ref={searchInputRef}
                id="catalog-search"
                type="search"
                value={text}
                onChange={(event) => setText(event.target.value)}
                placeholder="Search collection…"
              />
              {text && (
                <button
                  type="button"
                  className="search-clear-btn"
                  onClick={() => setText("")}
                  aria-label="Clear search text"
                >
                  ✕
                </button>
              )}
              <kbd aria-hidden="true">⌘ K</kbd>
            </div>
            <p className="filter-note">
              {text ? `Filtering for title/author containing "${text}"` : "Text match is applied as an additional filter (T)."}
            </p>
          </div>

          {/* Set Operation Selector */}
          <fieldset className="filter-group">
            <legend className="filter-group-legend">
              <span>Combine logic</span>
              <button
                type="button"
                className="genre-quick-btn"
                onClick={() => setShowGuide(true)}
              >
                Help ?
              </button>
            </legend>

            {/* Visual Segmented Control */}
            <div className="operation-segmented-bar" role="group" aria-label="Set operation buttons">
              {operations.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  className={`operation-tab ${operation === item.value ? "is-active" : ""}`}
                  onClick={() => setOperation(item.value)}
                >
                  <div className="operation-tab-name">
                    <span className="operation-symbol">{item.symbol}</span>
                    <span>{item.value.toUpperCase()}</span>
                  </div>
                  <span className="operation-tab-desc">{item.name}</span>
                </button>
              ))}
            </div>

            {/* Native Select for E2E Tests & Accessibility */}
            <div className="operation-native-select-wrap">
              <select
                id="set-operation"
                value={operation}
                onChange={(event) => setOperation(event.target.value as SetOperation)}
                aria-label="Set operation"
                className="operation-native-select"
              >
                {operations.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Friendly explanation helper card */}
            <div className="operation-helper-card">
              {operations.find((o) => o.value === operation)?.desc}
            </div>
          </fieldset>

          {/* Genre Selection */}
          <fieldset className="filter-group genre-group">
            <div className="genre-group-header">
              <legend className="filter-group-legend">
                <span>Genre subsets</span>
              </legend>
              <div className="genre-quick-actions">
                {selectedGenres.length > 0 && (
                  <button
                    type="button"
                    className="genre-quick-btn"
                    onClick={() => setSelectedGenres([])}
                  >
                    Clear ({selectedGenres.length})
                  </button>
                )}
              </div>
            </div>

            <div className="genre-list" role="group" aria-label="Select genres">
              {genres.map((genre) => (
                <div
                  key={genre}
                  className={`genre-item ${selectedGenres.includes(genre) ? "is-checked" : ""}`}
                >
                  <input
                    id={`genre-${genre}`}
                    type="checkbox"
                    checked={selectedGenres.includes(genre)}
                    onChange={() => toggleGenre(genre)}
                  />
                  <label htmlFor={`genre-${genre}`} className="genre-label">
                    <span className="custom-check" aria-hidden="true">
                      {selectedGenres.includes(genre) ? "✓" : ""}
                    </span>
                    <span className="genre-name">{genre}</span>
                  </label>
                  <span className="genre-count-badge" aria-hidden="true">
                    {genreCountsMap[genre] ?? 0}
                  </span>
                </div>
              ))}
            </div>
          </fieldset>

          {/* Availability Filter */}
          <fieldset className="filter-group">
            <legend className="filter-group-legend">
              <span>Lending availability</span>
            </legend>
            <div className="availability-options" role="radiogroup" aria-label="Filter by availability">
              {[
                { value: "any", label: "All books", badge: "All" },
                { value: "available", label: "Available only", badge: "On Shelf" },
                { value: "loaned", label: "On loan only", badge: "Borrowed" },
              ].map((opt) => (
                <div
                  key={opt.value}
                  className={`availability-item ${availability === opt.value ? "is-selected" : ""}`}
                >
                  <input
                    id={`avail-${opt.value}`}
                    type="radio"
                    name="availability"
                    value={opt.value}
                    checked={availability === opt.value}
                    onChange={() => setAvailability(opt.value as typeof availability)}
                  />
                  <label htmlFor={`avail-${opt.value}`} className="radio-label">
                    <span className="radio-dot" aria-hidden="true" />
                    <span className="radio-text">{opt.label}</span>
                  </label>
                  <span className={`status-pill pill-${opt.value}`} aria-hidden="true">
                    {opt.badge}
                  </span>
                </div>
              ))}
            </div>
          </fieldset>

          {/* Reset All Filters Button */}
          <button
            className="reset-button"
            type="button"
            onClick={resetAllFilters}
          >
            <span>↺</span> Reset all filters to Universe B
          </button>
        </aside>

        {/* Results Column */}
        <div className="results-column">
          {/* Results Header */}
          <div className="results-head">
            <div>
              <div className="section-kicker">
                <span>02</span> YOUR RESULTS
              </div>
              <h2>
                The collection, <em>intersected.</em>
              </h2>
            </div>
            <p className="universe-note">
              <span>B</span> · <span>{books.length} books in the universe</span>
            </p>
          </div>

          {/* Active Filter Chips Bar */}
          {activeFiltersCount > 0 && (
            <div className="active-filters-bar" aria-label="Active filters">
              <span className="active-filters-label">Active:</span>
              {selectedGenres.map((genre) => (
                <span key={genre} className="active-filter-chip">
                  Genre: <b>{genre}</b>
                  <button type="button" onClick={() => toggleGenre(genre)} aria-label={`Remove ${genre} filter`}>
                    ✕
                  </button>
                </span>
              ))}
              {selectedGenres.length > 1 && (
                <span className="active-filter-chip">
                  Op: <b>{operation.toUpperCase()}</b>
                </span>
              )}
              {availability !== "any" && (
                <span className="active-filter-chip">
                  Status: <b>{availability === "available" ? "Available only" : "On loan only"}</b>
                  <button type="button" onClick={() => setAvailability("any")} aria-label="Reset availability">
                    ✕
                  </button>
                </span>
              )}
              {text.trim() && (
                <span className="active-filter-chip">
                  Search: <b>&ldquo;{text.trim()}&rdquo;</b>
                  <button type="button" onClick={() => setText("")} aria-label="Clear search text">
                    ✕
                  </button>
                </span>
              )}
              {selectedRegion && (
                <span className="active-filter-chip">
                  Region: <b>{selectedRegion === "onlyA" ? `${selectedGenres[0]} only` : selectedRegion === "both" ? "Both" : `${selectedGenres[1]} only`}</b>
                  <button type="button" onClick={() => setSelectedRegion(null)} aria-label="Clear region filter">
                    ✕
                  </button>
                </span>
              )}
            </div>
          )}

          {/* The Mathematical Expression Card */}
          <section className="expression-card" aria-live="polite">
            <div className="expression-top">
              <span className="expression-label">SET LOGIC FORMULA</span>
              <span className="expression-universe">⊂ B &nbsp;·&nbsp; SUBSET OF ALL BOOKS</span>
            </div>
            <div className="expression-equation">{resultExpression}</div>
            <p className="expression-explanation">{resultExplanation}</p>
            {rawResult.error && (
              <div className="validation-message" role="alert">
                <span>Query constraint</span>
                <span>{rawResult.error}</span>
              </div>
            )}
            <div className="expression-footer">
              <div className="expression-footer-count">
                <strong>{filteredBooks.length}</strong> {filteredBooks.length === 1 ? "book" : "books"} match this expression
              </div>
              <span className="expression-match-pill" aria-hidden="true">
                Active Subset →
              </span>
            </div>
          </section>

          {/* Results Toolbar */}
          <div className="results-toolbar">
            <div className="toolbar-left">
              <span className="toolbar-count">
                {filteredBooks.length} TITLES <span style={{ color: "#94a3b8" }}>/</span> {books.length} IN UNIVERSE
              </span>
              <div className="view-mode-toggle" role="group" aria-label="View mode">
                <button
                  type="button"
                  className={`view-mode-btn ${viewMode === "grid" ? "is-active" : ""}`}
                  onClick={() => setViewMode("grid")}
                  aria-label="Grid view"
                >
                  <span>⊞</span> Grid
                </button>
                <button
                  type="button"
                  className={`view-mode-btn ${viewMode === "list" ? "is-active" : ""}`}
                  onClick={() => setViewMode("list")}
                  aria-label="List view"
                >
                  <span>☰</span> List
                </button>
              </div>
            </div>

            <div className="toolbar-right">
              <div className="sort-control">
                <label htmlFor="sort-books">Sort by:</label>
                <select
                  id="sort-books"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                  className="sort-select"
                >
                  <option value="title-asc">Title (A → Z)</option>
                  <option value="title-desc">Title (Z → A)</option>
                  <option value="year-desc">Year (Newest)</option>
                  <option value="year-asc">Year (Oldest)</option>
                  <option value="available">Availability (Available first)</option>
                </select>
              </div>

              <div className="available-legend" aria-hidden="true">
                <span className="legend-item">
                  <i className="status-dot" /> Available
                </span>
                <span className="legend-item">
                  <i className="status-dot status-loaned" /> On loan
                </span>
              </div>
            </div>
          </div>

          {/* Books Display (Grid or List View) */}
          {filteredBooks.length > 0 ? (
            viewMode === "grid" ? (
              <div className="book-grid">
                {filteredBooks.map((book, index) => (
                  <Link
                    href={`/books/${book.id}`}
                    className="book-card"
                    key={book.id}
                    aria-label={`${book.title} by ${book.author}`}
                  >
                    {/* Hardcover Book Cover Presentation */}
                    <div
                      className="book-cover"
                      style={{ backgroundColor: book.coverColor ?? "#0f766e" }}
                    >
                      <div className="cover-header">
                        <span className="cover-number">
                          #{String(index + 1).padStart(2, "0")}
                        </span>
                        {book.publicationYear && (
                          <span className="cover-year">{book.publicationYear}</span>
                        )}
                      </div>
                      <div className="cover-title">{book.title}</div>
                      <div className="cover-footer">
                        <span className="cover-author">{book.author}</span>
                        <span className="cover-mark" aria-hidden="true">
                          S∩B
                        </span>
                      </div>
                    </div>

                    {/* Book Metadata & Badges */}
                    <div className="book-meta">
                      <div className="book-title-row">
                        <h3>{book.title}</h3>
                        <span
                          className={`book-status ${
                            book.available ? "book-status-available" : "book-status-loaned"
                          }`}
                        >
                          <i
                            className={`status-dot ${book.available ? "" : "status-loaned"}`}
                            aria-hidden="true"
                          />
                          {book.available ? "Available" : "On loan"}
                        </span>
                      </div>
                      <p className="book-author-text">by {book.author}</p>
                      <div className="book-genres">
                        {book.genres.slice(0, 3).map((genre) => (
                          <span key={genre}>{genre}</span>
                        ))}
                      </div>
                      <p className="book-description">
                        {book.description || "No description recorded for this title."}
                      </p>
                      <div className="book-card-cta">
                        <span>View catalog record</span>
                        <span aria-hidden="true">→</span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="book-list-container">
                {filteredBooks.map((book, index) => (
                  <Link
                    href={`/books/${book.id}`}
                    className="book-card book-card-list"
                    key={book.id}
                    aria-label={`${book.title} by ${book.author}`}
                  >
                    <div
                      className="book-cover"
                      style={{ backgroundColor: book.coverColor ?? "#0f766e" }}
                    >
                      <div className="cover-header">
                        <span className="cover-number">#{String(index + 1).padStart(2, "0")}</span>
                      </div>
                      <div className="cover-title">{book.title}</div>
                      <div className="cover-footer">
                        <span className="cover-author">{book.author}</span>
                      </div>
                    </div>

                    <div className="book-meta">
                      <div className="book-title-row">
                        <h3>{book.title}</h3>
                        <span
                          className={`book-status ${
                            book.available ? "book-status-available" : "book-status-loaned"
                          }`}
                        >
                          <i
                            className={`status-dot ${book.available ? "" : "status-loaned"}`}
                            aria-hidden="true"
                          />
                          {book.available ? "Available" : "On loan"}
                        </span>
                      </div>
                      <p className="book-author-text">by {book.author} {book.publicationYear ? `(${book.publicationYear})` : ""}</p>
                      <div className="book-genres">
                        {book.genres.map((genre) => (
                          <span key={genre}>{genre}</span>
                        ))}
                      </div>
                      <p className="book-description">{book.description}</p>
                    </div>

                    <div className="book-card-cta" style={{ border: 0, padding: 0 }}>
                      <span>Details →</span>
                    </div>
                  </Link>
                ))}
              </div>
            )
          ) : !rawResult.error ? (
            <div className="empty-state">
              <span className="empty-symbol" aria-hidden="true">
                ∅
              </span>
              <h3>No books in this set (Empty Set).</h3>
              <p>
                {selectedRegion
                  ? "No books currently match this specific Venn region with your active availability/text filters."
                  : "No titles match this combination of genre operations and filters. Try choosing a different operation (like Union · OR) or broadening your query."}
              </p>
              <button
                type="button"
                className="primary-button"
                onClick={resetAllFilters}
              >
                Reset all filters
              </button>
            </div>
          ) : null}

          {/* The Mathematics & Venn Section */}
          <section className="math-panel">
            <div className="math-header">
              <div>
                <div className="section-kicker">
                  <span>03</span> THE MATHEMATICS
                </div>
                <h3>See how the sets overlap.</h3>
              </div>
              <button
                type="button"
                className="secondary-button"
                onClick={() => setShowGuide(true)}
              >
                Learn Set Theory
              </button>
            </div>

            <div className="math-content">
              <div>
                <p style={{ color: "#475569", fontSize: 14, lineHeight: 1.6, margin: "0 0 16px" }}>
                  SetLib translates library genres into mathematical sets. When you select two genres, you can explore their unique subsets, shared intersections, and symmetric differences in real time.
                </p>
                {selectedGenres.length === 2 && (
                  <div style={{ padding: 14, background: "#f0fdfa", border: "1px solid #ccfbf1", borderRadius: 8, fontSize: 13, color: "#0f766e" }}>
                    <b>Active Comparison:</b> {selectedGenres[0]} (A) vs. {selectedGenres[1]} (B).
                  </div>
                )}
              </div>

              {selectedGenres.length === 2 ? (
                <VennDiagram
                  onlyA={rawResult.regions.onlyA}
                  both={rawResult.regions.both}
                  onlyB={rawResult.regions.onlyB}
                  names={selectedGenres}
                  operation={operation}
                  counts={rawResult.genreCounts}
                  intersectionCount={rawResult.intersectionCount}
                  onSelectRegion={(reg) => setSelectedRegion(reg)}
                  activeRegion={selectedRegion}
                />
              ) : (
                <div className="math-summary">
                  {rawResult.genreCounts.length ? (
                    rawResult.genreCounts.map(({ name, symbol, count }) => (
                      <div key={name} className="math-summary-card">
                        <span>
                          |{symbol}| = Set {name}
                        </span>
                        <strong>{count} books</strong>
                      </div>
                    ))
                  ) : (
                    <div className="math-summary-card">
                      <span>|B| = The Library Universe</span>
                      <strong>{books.length} books</strong>
                    </div>
                  )}
                  {rawResult.intersectionCount !== null && (
                    <div className="math-summary-card">
                      <span>|A ∩ B| = Shared Overlap</span>
                      <strong>{rawResult.intersectionCount} books</strong>
                    </div>
                  )}
                  <div className="math-summary-card" style={{ background: "#f0fdfa", borderColor: "#99f6e4" }}>
                    <span>|Result| = Current Result Subset</span>
                    <strong>{filteredBooks.length} books</strong>
                  </div>
                  {selectedGenres.length !== 2 && (
                    <p style={{ fontSize: 12, color: "#64748b", margin: "8px 0 0" }}>
                      Tip: Select exactly two genres to render the interactive Venn diagram and explore set overlap.
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Set Theory Cheat Sheet */}
            <div className="math-legend">
              <div className="legend-card">
                <span className="legend-card-symbol">B</span>
                <span className="legend-card-desc"><b>Universe:</b> All books cataloged in the library stacks.</span>
              </div>
              <div className="legend-card">
                <span className="legend-card-symbol">V & Vc</span>
                <span className="legend-card-desc"><b>Availability:</b> V is on shelf; Vc is the complement (on loan).</span>
              </div>
              <div className="legend-card">
                <span className="legend-card-symbol">∩ & ∪</span>
                <span className="legend-card-desc"><b>AND / OR:</b> ∩ is intersection (both); ∪ is union (either).</span>
              </div>
              <div className="legend-card">
                <span className="legend-card-symbol">∖ & △</span>
                <span className="legend-card-desc"><b>NOT / XOR:</b> ∖ is difference (A not B); △ is symmetric difference.</span>
              </div>
            </div>

            {/* Matching Titles Cloud */}
            <div className="matching-titles-section">
              <div className="matching-titles-header">RESULT SUBSET MEMBERS ({filteredBooks.length})</div>
              <div className="matching-titles-cloud" aria-label="Matching book titles">
                {filteredBooks.length > 0 ? (
                  filteredBooks.map((book) => (
                    <Link
                      key={book.id}
                      href={`/books/${book.id}`}
                      className="matching-title-tag"
                    >
                      {book.title}
                    </Link>
                  ))
                ) : (
                  <span style={{ color: "#94a3b8", fontStyle: "italic", fontSize: 13 }}>
                    ∅ (Empty set — no matching titles)
                  </span>
                )}
              </div>
            </div>
          </section>

          {/* Footer */}
          <footer className="page-footer">
            <span>
              <strong>SETLIB</strong> · A STUDY IN LIBRARY DISCOVERY
            </span>
            <span>Every book is an element of universe B.</span>
          </footer>
        </div>
      </section>

      {/* Customer Guide Modal / Drawer */}
      {showGuide && (
        <div className="guide-backdrop" onClick={() => setShowGuide(false)} role="dialog" aria-modal="true" aria-label="How SetLib Works Guide">
          <div className="guide-drawer" onClick={(e) => e.stopPropagation()}>
            <div className="guide-header">
              <h3>How SetLib Works</h3>
              <button
                type="button"
                className="guide-close-btn"
                onClick={() => setShowGuide(false)}
                aria-label="Close guide"
              >
                ✕
              </button>
            </div>

            <div className="guide-content">
              <div className="guide-step">
                <span className="guide-step-num">01 / CONCEPT</span>
                <h4>The Library as a Universe (B)</h4>
                <p>
                  In set theory, a universe contains every possible item. Here, universe <b>B</b> represents all 25 books in our catalog. Every book is a member (b ∈ B).
                </p>
              </div>

              <div className="guide-step">
                <span className="guide-step-num">02 / GENRES</span>
                <h4>Genres are Subsets</h4>
                <p>
                  Genres like <i>Fiction</i> (F) or <i>Science Fiction</i> (S) are subsets of B. A book can belong to one, multiple, or no selected genres.
                </p>
              </div>

              <div className="guide-step">
                <span className="guide-step-num">03 / OPERATIONS</span>
                <h4>Combining Subsets</h4>
                <p>
                  <b>Intersection (∩ · AND):</b> Only books classified under ALL selected genres.<br /><br />
                  <b>Union (∪ · OR):</b> Books classified under ANY of the selected genres.<br /><br />
                  <b>Difference (∖ · NOT):</b> Books in the first genre that are EXCLUDED from the second genre.<br /><br />
                  <b>Symmetric Difference (△ · XOR):</b> Books in one genre or the other, but NEVER both.
                </p>
              </div>

              <div className="guide-step">
                <span className="guide-step-num">04 / AVAILABILITY</span>
                <h4>Availability as a Complement (V & Vc)</h4>
                <p>
                  Set <b>V</b> contains all books currently on the shelf and ready to borrow. Its mathematical complement, <b>Vc</b>, contains books currently on loan.
                </p>
              </div>

              <button
                type="button"
                className="primary-button"
                style={{ width: "100%", marginTop: 12 }}
                onClick={() => setShowGuide(false)}
              >
                Got it, start exploring!
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
