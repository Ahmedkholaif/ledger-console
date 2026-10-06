import Link from 'next/link';
import { connection } from 'next/server';
import { Suspense } from 'react';
import { AccountForm } from '@/components/account-form';
import { TransferForm } from '@/components/transfer-form';
import { Money, Skeleton } from '@/components/ui';
import { listAccounts } from '@/lib/ledger';
import { formatMoney } from '@/lib/money';

// The static shell (headings, forms' frames, skeletons) is prerendered at
// build time. Account data streams into the Suspense holes per request.
export default function Dashboard() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="h1">Accounts</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">Balances are derived from an append-only, double-entry journal.</p>
      </div>
      <Suspense fallback={<Skeleton rows={2} />}>
        <Totals />
      </Suspense>
      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <Suspense fallback={<Skeleton rows={6} />}>
          <AccountsTable />
        </Suspense>
        <div className="space-y-6">
          <Suspense fallback={<Skeleton rows={5} />}>
            <TransferPanel />
          </Suspense>
          <AccountForm />
        </div>
      </div>
    </div>
  );
}

async function Totals() {
  await connection(); // live data: render per request, never at build time
  const accounts = await listAccounts();
  const byCurrency = new Map<string, { held: number; count: number }>();
  for (const a of accounts) {
    const t = byCurrency.get(a.currency) ?? { held: 0, count: 0 };
    if (a.balance > 0) t.held += a.balance; // customer funds: the positive side of the books
    t.count++;
    byCurrency.set(a.currency, t);
  }
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <div className="card">
        <div className="hint">ACCOUNTS</div>
        <div className="mt-1 text-2xl font-semibold tabular-nums">{accounts.length}</div>
      </div>
      {[...byCurrency].slice(0, 2).map(([cur, t]) => (
        <div key={cur} className="card">
          <div className="hint">HELD · {cur}</div>
          <div className="mt-1 text-2xl font-semibold tabular-nums">{formatMoney(t.held, cur)}</div>
        </div>
      ))}
    </div>
  );
}

async function AccountsTable() {
  await connection(); // live data: render per request, never at build time
  const accounts = await listAccounts();
  if (accounts.length === 0) {
    return <div className="card text-sm text-[var(--muted)]">No accounts yet. Open a funding account (allow negative) and a customer account to get started.</div>;
  }
  return (
    <div className="card overflow-x-auto">
      <table className="table" data-testid="accounts">
        <thead>
          <tr>
            <th>Name</th>
            <th>Currency</th>
            <th className="text-right">Balance</th>
          </tr>
        </thead>
        <tbody>
          {accounts.map((a) => (
            <tr key={a.id}>
              <td>
                <Link href={`/accounts/${a.id}`} className="font-medium hover:underline">
                  {a.name}
                </Link>
                {a.allow_negative && <span className="hint ml-2">funding</span>}
              </td>
              <td className="mono">{a.currency}</td>
              <td className="text-right" data-testid={`balance-${a.name}`}>
                <Money minor={a.balance} currency={a.currency} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

async function TransferPanel() {
  await connection(); // live data: render per request, never at build time
  const accounts = await listAccounts();
  return <TransferForm accounts={accounts.map(({ id, name, currency, balance }) => ({ id, name, currency, balance }))} />;
}
