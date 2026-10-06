'use client';

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="card mx-auto max-w-md space-y-3 text-center">
      <h1 className="h1">The ledger is unreachable</h1>
      <p className="text-sm text-[var(--muted)]">Check that ledgerd or ledger-nest is running and that LEDGER_API_URL points at it.</p>
      {error.digest && <p className="hint">ref {error.digest}</p>}
      <button className="btn" onClick={reset}>
        Try again
      </button>
    </div>
  );
}
