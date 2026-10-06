import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { Money, Skeleton, shortId, when } from '@/components/ui';
import { getAccount, getTransfer } from '@/lib/ledger';

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return { title: `Transfer ${shortId((await params).id)}` };
}

export default function TransferPage({ params }: Props) {
  return (
    <div className="space-y-6">
      <Link href="/" className="text-sm text-[var(--muted)] hover:underline">
        ← All accounts
      </Link>
      <Suspense fallback={<Skeleton rows={5} />}>
        <TransferView params={params} />
      </Suspense>
    </div>
  );
}

async function TransferView({ params }: Props) {
  const { id } = await params;
  const transfer = await getTransfer(id); // immutable → cached with cacheLife('max')
  if (!transfer) notFound();
  const accounts = await Promise.all(transfer.entries.map((e) => getAccount(e.account_id)));

  return (
    <div className="card space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="hint">TRANSFER · {transfer.id}</div>
          <h1 className="h1 mt-1">{transfer.description || 'Untitled transfer'}</h1>
          <div className="mt-1 text-sm text-[var(--muted)]">{when(transfer.created_at)}</div>
        </div>
        <div className="text-right text-sm">
          <div className="hint">IDEMPOTENCY KEY</div>
          <div className="mono mt-1 break-all">{transfer.idempotency_key}</div>
        </div>
      </div>
      <table className="table">
        <thead>
          <tr>
            <th>Account</th>
            <th className="text-right">Debit</th>
            <th className="text-right">Credit</th>
            <th className="text-right">Balance after</th>
          </tr>
        </thead>
        <tbody>
          {transfer.entries.map((e, i) => (
            <tr key={e.id}>
              <td>
                <Link href={`/accounts/${e.account_id}`} className="font-medium hover:underline">
                  {accounts[i]?.name ?? shortId(e.account_id)}
                </Link>
              </td>
              <td className="text-right">{e.amount < 0 && <Money minor={-e.amount} currency={e.currency} />}</td>
              <td className="text-right">{e.amount > 0 && <Money minor={e.amount} currency={e.currency} />}</td>
              <td className="text-right">
                <Money minor={e.balance_after} currency={e.currency} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-xs text-[var(--muted)]">Debits equal credits in every currency. The ledger enforces this at commit time.</p>
    </div>
  );
}
