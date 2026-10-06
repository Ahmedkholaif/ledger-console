import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { Money, Skeleton, shortId, when } from '@/components/ui';
import { getAccount, listEntries } from '@/lib/ledger';

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ after?: string }> };

export default function AccountPage({ params, searchParams }: Props) {
  return (
    <div className="space-y-6">
      <Link href="/" className="text-sm text-[var(--muted)] hover:underline">
        ← All accounts
      </Link>
      <Suspense fallback={<Skeleton rows={2} />}>
        <Header params={params} />
      </Suspense>
      <Suspense fallback={<Skeleton rows={8} />}>
        <Journal params={params} searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Header({ params }: Pick<Props, 'params'>) {
  const { id } = await params;
  const account = await getAccount(id);
  if (!account) notFound();
  return (
    <div className="card flex flex-wrap items-end justify-between gap-4">
      <div>
        <div className="hint">ACCOUNT · {shortId(account.id)}</div>
        <h1 className="h1 mt-1">{account.name}</h1>
        <div className="mt-1 text-sm text-[var(--muted)]">
          {account.currency} · opened {when(account.created_at)}
          {account.allow_negative && ' · may go negative'}
        </div>
      </div>
      <div className="text-right">
        <div className="hint">BALANCE</div>
        <div className="text-3xl font-semibold" data-testid="account-balance">
          <Money minor={account.balance} currency={account.currency} />
        </div>
        <a href={`/accounts/${account.id}/export`} className="mt-2 inline-block text-sm text-[var(--accent)] hover:underline" download>
          Export journal (CSV) ↓
        </a>
      </div>
    </div>
  );
}

// Journal entries are never cached: this always reflects the ledger right now.
async function Journal({ params, searchParams }: Props) {
  const [{ id }, { after }] = await Promise.all([params, searchParams]);
  const cursor = Number(after) || 0;
  const page = await listEntries(id, cursor, 25).catch(() => null);
  if (!page) notFound();

  return (
    <div className="card overflow-x-auto">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="h2">Journal</h2>
        <span className="hint">keyset-paginated · append-only</span>
      </div>
      {page.entries.length === 0 ? (
        <p className="text-sm text-[var(--muted)]">{cursor ? 'No more entries.' : 'No entries yet.'}</p>
      ) : (
        <table className="table" data-testid="journal">
          <thead>
            <tr>
              <th>#</th>
              <th>When</th>
              <th>Transfer</th>
              <th className="text-right">Amount</th>
              <th className="text-right">Balance after</th>
            </tr>
          </thead>
          <tbody>
            {page.entries.map((e) => (
              <tr key={e.id}>
                <td className="mono text-[var(--muted)]">{e.id}</td>
                <td>{when(e.created_at)}</td>
                <td>
                  <Link href={`/transfers/${e.transfer_id}`} className="mono hover:underline">
                    {shortId(e.transfer_id)}
                  </Link>
                </td>
                <td className="text-right">
                  <Money minor={e.amount} currency={e.currency} signed />
                </td>
                <td className="text-right">
                  <Money minor={e.balance_after} currency={e.currency} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <div className="mt-4 flex gap-4 text-sm">
        {cursor > 0 && (
          <Link href={`/accounts/${id}`} className="text-[var(--accent)] hover:underline">
            ⇤ First page
          </Link>
        )}
        {page.next_after && page.entries.length === 25 && (
          <Link href={`/accounts/${id}?after=${page.next_after}`} className="text-[var(--accent)] hover:underline">
            Next page →
          </Link>
        )}
      </div>
    </div>
  );
}
