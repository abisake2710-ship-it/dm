"use client";

import { useEffect } from "react";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("SetLib page error:", error);
  }, [error]);

  return (
    <main className="setup-error">
      <p className="eyebrow">SETLIB · SOMETHING WENT ASTRAY</p>
      <h1>The catalog could not be opened.</h1>
      <p>Please try again. If the problem persists, check the development server logs.</p>
      <button className="primary-button" onClick={reset}>Try again</button>
    </main>
  );
}
