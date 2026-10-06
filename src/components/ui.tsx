import { connection } from 'next/server';
import { getAudit } from '@/lib/ledger';
import { formatMoney } from '@/lib/money';

export function Money({ minor, currency, signed = false }: { minor: number; currency: string; signed?: boolean }) {
  const text = formatMoney(minor, currency);
  const tone = !signed ? '' : minor < 0 ? 'text-[var(--neg)]' : 'text-[var(--pos)]';
  return <span className={`tabular-nums ${tone}`}>{signed && minor > 0 ? `+${text}` : text}</span>;
}

/** Live reconciliation status, recomputed by the ledger from its journal. */
export async function AuditBadge() {
  await connection();
  const audit = await getAudit().catch(() => null);
  if (!audit) return <span className="badge badge-err">● Ledger API unreachable</span>;
  if (!audit.consistent) return <span className="badge badge-err">● {audit.mismatches.length} audit mismatches</span>;
  return (
    <span className="badge badge-ok" title="Every balance matches its journal and each currency nets to zero">
      ● Books balanced
    </span>
  );
}

export function Skeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="card space-y-3" aria-busy="true">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="h-5 animate-pulse rounded bg-[var(--line)]" style={{ width: `${90 - i * 12}%` }} />
      ))}
    </div>
  );
}

export function shortId(id: string) {
  return id.slice(0, 8);
}

export function when(iso: string) {
  return new Date(iso).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' }) + ' UTC';
}
