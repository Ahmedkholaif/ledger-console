import 'server-only';
import { cacheLife, cacheTag } from 'next/cache';

// Typed client for the ledger API. It works against either backend, ledgerd
// (Go) or ledger-nest (NestJS), since they share one HTTP contract. This
// module is server-only: the API URL and key never reach the browser.

export type Account = {
  id: string;
  name: string;
  currency: string;
  allow_negative: boolean;
  balance: number;
  created_at: string;
};

export type Entry = {
  id: number;
  transfer_id: string;
  account_id: string;
  amount: number;
  currency: string;
  balance_after: number;
  created_at: string;
};

export type Transfer = {
  id: string;
  idempotency_key: string;
  description: string;
  created_at: string;
  entries: Entry[];
};

export type Audit = { consistent: boolean; mismatches: { kind: string; id: string; expected: number; actual: number }[] };

export class LedgerApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

const BASE = process.env.LEDGER_API_URL ?? 'http://localhost:8080';

async function api<T>(path: string, init?: RequestInit & { idempotencyKey?: string }): Promise<{ data: T; res: Response }> {
  const headers = new Headers(init?.headers);
  headers.set('Content-Type', 'application/json');
  if (process.env.LEDGER_API_KEY) headers.set('Authorization', `Bearer ${process.env.LEDGER_API_KEY}`);
  if (init?.idempotencyKey) headers.set('Idempotency-Key', init.idempotencyKey);

  const res = await fetch(BASE + path, { ...init, headers, cache: 'no-store' });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    throw new LedgerApiError(res.status, body?.error?.code ?? 'http_error', body?.error?.message ?? `ledger API ${res.status}`);
  }
  return { data: body as T, res };
}

// ---- Cached reads ---------------------------------------------------------
// Balances can also change outside this console, so cached reads only live
// for seconds. Our own writes invalidate them immediately through updateTag()
// in the server actions (read-your-own-writes).
const shortLived = { stale: 5, revalidate: 10, expire: 60 };

export async function listAccounts(): Promise<Account[]> {
  'use cache';
  cacheTag('accounts');
  cacheLife(shortLived);
  return (await api<{ accounts: Account[] }>('/v1/accounts?limit=500')).data.accounts;
}

export async function getAccount(id: string): Promise<Account | null> {
  'use cache';
  cacheTag(`account:${id}`);
  cacheLife(shortLived);
  try {
    return (await api<Account>(`/v1/accounts/${encodeURIComponent(id)}`)).data;
  } catch (err) {
    if (err instanceof LedgerApiError && err.status === 404) return null;
    throw err;
  }
}

export async function getAudit(): Promise<Audit> {
  'use cache';
  cacheTag('audit');
  cacheLife({ stale: 10, revalidate: 30, expire: 120 });
  return (await api<Audit>('/v1/audit')).data;
}

/** Transfers are immutable once written, so they can be cached for as long as the cache allows. */
export async function getTransfer(id: string): Promise<Transfer | null> {
  'use cache';
  cacheLife('max');
  try {
    return (await api<Transfer>(`/v1/transfers/${encodeURIComponent(id)}`)).data;
  } catch (err) {
    if (err instanceof LedgerApiError && err.status === 404) return null;
    throw err;
  }
}

// ---- Uncached reads (always fresh, streamed behind <Suspense>) ------------

export async function listEntries(accountId: string, after = 0, limit = 25) {
  return (await api<{ entries: Entry[]; next_after: number | null }>(`/v1/accounts/${encodeURIComponent(accountId)}/entries?after=${after}&limit=${limit}`)).data;
}

// ---- Writes ---------------------------------------------------------------

export async function createAccount(input: { name: string; currency: string; allow_negative: boolean }) {
  return (await api<Account>('/v1/accounts', { method: 'POST', body: JSON.stringify(input) })).data;
}

export async function createTransfer(idempotencyKey: string, input: { description: string; postings: { account_id: string; amount: number }[] }) {
  const { data, res } = await api<Transfer>('/v1/transfers', { method: 'POST', body: JSON.stringify(input), idempotencyKey });
  return { transfer: data, replayed: res.headers.get('Idempotent-Replayed') === 'true' };
}
