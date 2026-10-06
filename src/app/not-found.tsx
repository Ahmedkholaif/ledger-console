import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="card mx-auto max-w-md space-y-3 text-center">
      <h1 className="h1">Not found</h1>
      <p className="text-sm text-[var(--muted)]">That account or transfer doesn&apos;t exist in this ledger.</p>
      <Link href="/" className="btn inline-block">
        Back to accounts
      </Link>
    </div>
  );
}
