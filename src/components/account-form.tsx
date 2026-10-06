'use client';

import { useActionState } from 'react';
import { createAccountAction, type ActionState } from '@/app/actions';
import { Status } from './transfer-form';

export function AccountForm() {
  const [state, action, pending] = useActionState<ActionState, FormData>(createAccountAction, { status: 'idle' });
  const f = state.status === 'error' ? (state.fields ?? {}) : {};

  return (
    <form action={action} className="card space-y-4" data-testid="account-form">
      <h2 className="h2">Open account</h2>
      <div className="grid gap-3 sm:grid-cols-[1fr_110px]" key={state.status === 'error' ? state.at : 0}>
        <label className="field">
          <span>Name</span>
          <input name="name" placeholder="Merchant payouts" required maxLength={200} defaultValue={f.name} />
        </label>
        <label className="field">
          <span>Currency</span>
          <input name="currency" defaultValue={f.currency ?? 'USD'} required pattern="[A-Z]{3}" maxLength={3} className="uppercase" />
        </label>
      </div>
      <label className="flex items-center gap-2 text-sm text-[var(--muted)]">
        <input type="checkbox" name="allow_negative" className="accent-[var(--accent)]" />
        Allow negative balance (funding / clearing account)
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <button className="btn btn-quiet" disabled={pending}>
          {pending ? 'Opening…' : 'Open account'}
        </button>
        <Status state={state} />
      </div>
    </form>
  );
}
