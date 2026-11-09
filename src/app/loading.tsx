export default function Loading() {
  return (
    <main className="loading-shell" aria-label="Loading the catalog" aria-busy="true">
      <div className="loading-mark">S∩B</div>
      <p>Opening the stacks…</p>
      <div className="loading-line" />
    </main>
  );
}
