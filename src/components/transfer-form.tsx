'use client';

import Link from 'next/link';
import { useActionState, useEffect, useRef } from 'react';
import { transferAction, type ActionState } from '@/app/actions';
import { formatMoney } from '@/lib/money';

type Option = { id: string; name: string; currency: string; balance: number };

export function TransferForm({ accounts }: { accounts: Option[] }) {
  const [state, dispatch, pending] = useActionState<ActionState, FormData>(transferAction, { status: 'idle' });

  // One idempotency key per *intended* transfer, minted in the browser on
  // first submit. A double-click or a resubmission reuses it, so the ledger
  // moves the money once and replays the result for the duplicates. Only a
  // transfer that went through retires the key.
  const key = useRef<string | null>(null);
  const submit = (form: FormData) => {
    key.current ??= crypto.randomUUID();
    form.set('idempotencyKey', key.current);
    dispatch(form);
  };
  useEffect(() => {
    if (state.status === 'success' && !state.replayed) key.current = null;
  }, [state]);

  // React resets the form after each submission; on error, the fields come
  // back from the action state so nothing the user typed is lost.
  const f = state.status === 'error' ? (state.fields ?? {}) : {};
  const k = state.status === 'error' ? state.at : 0;

  return (
    <form action={submit} className="card space-y-4" data-testid="transfer-form">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="h2">New transfer</h2>
        <span className="hint">idempotent · double-submit safe</span>
      </div>
      <div className="grid gap-3 sm:grid-cols-2" key={`a${k}`}>
        <Select name="from" label="From" accounts={accounts} value={f.from} />
        <Select name="to" label="To" accounts={accounts} value={f.to} />
      </div>
      <div className="grid gap-3 sm:grid-cols-[160px_1fr]" key={`b${k}`}>
        <label className="field">
          <span>Amount</span>
          <input name="amount" inputMode="decimal" placeholder="25.00" required autoComplete="off" defaultValue={f.amount} />
        </label>
        <label className="field">
          <span>Description</span>
          <input name="description" placeholder="Invoice #1042" maxLength={1000} defaultValue={f.description} />
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button className="btn" disabled={pending || accounts.length < 2}>
          {pending ? 'Applying…' : 'Move money'}
        </button>
        <Status state={state} />
      </div>
    </form>
  );
}

function Select({ name, label, accounts, value }: { name: string; label: string; accounts: Option[]; value?: string }) {
  return (
    <label className="field">
      <span>{label}</span>
      <select name={name} required defaultValue={value ?? ''}>
        <option value="" disabled>
          Choose account…
        </option>
        {accounts.map((a) => (
          <option key={a.id} value={a.id}>
            {a.name} · {formatMoney(a.balance, a.currency)}
          </option>
        ))}
      </select>
    </label>
  );
}

export function Status({ state }: { state: ActionState }) {
  if (state.status === 'idle') return null;
  const tone = state.status === 'error' ? 'status-err' : state.replayed ? 'status-warn' : 'status-ok';
  return (
    <p role="status" key={state.at} className={`status ${tone}`}>
      {state.message}
      {state.status === 'success' && state.transferId && (
        <>
          {' · '}
          <Link href={`/transfers/${state.transferId}`} className="underline underline-offset-2">
            view transfer
          </Link>
        </>
      )}
    </p>
  );
}
