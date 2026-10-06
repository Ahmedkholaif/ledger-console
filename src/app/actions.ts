'use server';

import { updateTag } from 'next/cache';
import { z } from 'zod';
import { createAccount, createTransfer, getAccount, LedgerApiError } from '@/lib/ledger';
import { parseAmount } from '@/lib/money';

export type ActionState =
  | { status: 'idle' }
  | { status: 'success'; message: string; transferId?: string; replayed?: boolean; at: number }
  | { status: 'error'; message: string; at: number; fields?: Record<string, string> };

const transferSchema = z
  .object({
    idempotencyKey: z.uuid(),
    from: z.uuid({ error: 'Choose the account to debit' }),
    to: z.uuid({ error: 'Choose the account to credit' }),
    amount: z.string().min(1, 'Enter an amount'),
    description: z.string().max(1000).default(''),
  })
  .refine((v) => v.from !== v.to, { message: 'From and To must be different accounts' });

/**
 * Moves money between two accounts.
 *
 * The idempotency key is minted in the browser on first submit and kept
 * until a transfer succeeds. A double-click, a flaky network retry or a
 * resubmitted form all carry the same key, so the ledger applies the money
 * movement exactly once and replays the original result for the rest.
 */
export async function transferAction(_: ActionState, form: FormData): Promise<ActionState> {
  const fields = Object.fromEntries([...form].filter(([k, v]) => k !== 'idempotencyKey' && typeof v === 'string')) as Record<string, string>;
  const fail = (message: string): ActionState => ({ status: 'error', message, at: Date.now(), fields });
  const parsed = transferSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const { idempotencyKey, from, to, amount, description } = parsed.data;

  const [src, dst] = await Promise.all([getAccount(from), getAccount(to)]);
  if (!src || !dst) return fail('Account not found');
  if (src.currency !== dst.currency) {
    return fail(`Currency mismatch: ${src.currency} → ${dst.currency}`);
  }
  const minor = parseAmount(amount, src.currency);
  if (minor === null) return fail(`"${amount}" is not a valid ${src.currency} amount`);

  try {
    const { transfer, replayed } = await createTransfer(idempotencyKey, {
      description,
      postings: [
        { account_id: from, amount: -minor },
        { account_id: to, amount: minor },
      ],
    });
    // Read-your-own-writes: expire exactly the cached data this transfer
    // touched, so the very next render shows the new balances.
    updateTag('accounts');
    updateTag(`account:${from}`);
    updateTag(`account:${to}`);
    updateTag('audit');
    return {
      status: 'success',
      transferId: transfer.id,
      replayed,
      message: replayed ? 'Already processed: replayed the original transfer, no money moved twice' : 'Transfer applied',
      at: Date.now(),
    };
  } catch (err) {
    if (err instanceof LedgerApiError) return fail(friendly(err));
    throw err;
  }
}

const accountSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(200),
  currency: z.string().regex(/^[A-Z]{3}$/, 'Use a 3-letter currency code'),
  allow_negative: z.literal('on').optional(),
});

export async function createAccountAction(_: ActionState, form: FormData): Promise<ActionState> {
  const fields = Object.fromEntries([...form].filter(([, v]) => typeof v === 'string')) as Record<string, string>;
  const parsed = accountSchema.safeParse(fields);
  if (!parsed.success) return { status: 'error', message: parsed.error.issues[0].message, at: Date.now(), fields };
  try {
    const a = await createAccount({ ...parsed.data, allow_negative: parsed.data.allow_negative === 'on' });
    updateTag('accounts');
    return { status: 'success', message: `Opened ${a.name} (${a.currency})`, at: Date.now() };
  } catch (err) {
    if (err instanceof LedgerApiError) return { status: 'error', message: friendly(err), at: Date.now(), fields };
    throw err;
  }
}

function friendly(err: LedgerApiError): string {
  switch (err.code) {
    case 'insufficient_funds':
      return 'Insufficient funds: the source account would go negative';
    case 'idempotency_conflict':
      return 'This form was already used for a different transfer. Reload and try again.';
    default:
      return err.message;
  }
}
