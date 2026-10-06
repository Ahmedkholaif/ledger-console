import { expect, request as pwRequest, test, type APIRequestContext } from '@playwright/test';

const API = process.env.LEDGER_API_URL ?? 'http://127.0.0.1:8080';
let api: APIRequestContext;
let run: string;
let alice: string;
let bob: string;

test.beforeAll(async () => {
  api = await pwRequest.newContext({ baseURL: API });
  run = Math.random().toString(36).slice(2, 7);
  const open = async (name: string, allow_negative = false) =>
    (await (await api.post('/v1/accounts', { data: { name, currency: 'USD', allow_negative } })).json()).id as string;
  const world = await open(`world-${run}`, true);
  alice = await open(`alice-${run}`);
  bob = await open(`bob-${run}`);
  await api.post('/v1/transfers', {
    headers: { 'Idempotency-Key': `seed-${run}` },
    data: { postings: [{ account_id: world, amount: -10_000 }, { account_id: alice, amount: 10_000 }] },
  });
});

const balance = async (id: string) => (await (await api.get(`/v1/accounts/${id}`)).json()).balance as number;
const entryCount = async (id: string) => (await (await api.get(`/v1/accounts/${id}/entries?limit=500`)).json()).entries.length as number;

// Accounts were created straight through the API, outside the console, so
// the console's short-lived cache shows them within ~10s. (Writes made
// *through* the console are visible at once; see the first test.)
async function openDashboard(page: import('@playwright/test').Page) {
  await expect(async () => {
    await page.goto('/');
    await expect(page.getByTestId(`balance-bob-${run}`)).toBeVisible({ timeout: 1000 });
  }).toPass({ timeout: 20_000 });
}

async function fillTransfer(page: import('@playwright/test').Page, amount: string) {
  const form = page.getByTestId('transfer-form');
  await form.getByLabel('From').selectOption(alice);
  await form.getByLabel('To').selectOption(bob);
  await form.getByLabel('Amount').fill(amount);
  return form;
}

test('a transfer shows up immediately (read-your-own-writes)', async ({ page }) => {
  await openDashboard(page);
  await expect(page.getByTestId(`balance-alice-${run}`)).toHaveText('$100.00');
  const form = await fillTransfer(page, '12.50');
  await form.getByRole('button', { name: 'Move money' }).click();
  await expect(form.getByRole('status')).toContainText('Transfer applied');
  await expect(page.getByTestId(`balance-alice-${run}`)).toHaveText('$87.50');
  await expect(page.getByTestId(`balance-bob-${run}`)).toHaveText('$12.50');
  await expect(page.getByText('Books balanced')).toBeVisible();
});

test('submitting the same form twice moves money once', async ({ page }) => {
  await openDashboard(page);
  const before = { bal: await balance(bob), entries: await entryCount(bob) };
  await fillTransfer(page, '5.00');
  // Two submissions in the same tick, like a double-click or an eager retry.
  await page.getByTestId('transfer-form').evaluate((f: HTMLFormElement) => {
    f.requestSubmit();
    f.requestSubmit();
  });
  await expect(page.getByTestId('transfer-form').getByRole('status')).toContainText('replayed the original transfer');
  expect(await balance(bob)).toBe(before.bal + 500);
  expect(await entryCount(bob)).toBe(before.entries + 1);
});

test('insufficient funds keeps what the user typed', async ({ page }) => {
  await openDashboard(page);
  const form = await fillTransfer(page, '1000000');
  await form.getByRole('button', { name: 'Move money' }).click();
  await expect(form.getByRole('status')).toContainText('Insufficient funds');
  await expect(form.getByLabel('Amount')).toHaveValue('1000000');
});

test('account page streams the journal and exports CSV', async ({ page, request }) => {
  await page.goto(`/accounts/${alice}`);
  await expect(page.getByTestId('account-balance')).toContainText('$');
  await expect(page.getByTestId('journal').locator('tbody tr')).toHaveCount(await entryCount(alice));

  const csv = await request.get(`/accounts/${alice}/export`);
  expect(csv.headers()['content-type']).toContain('text/csv');
  const lines = (await csv.text()).trim().split('\n');
  expect(lines[0]).toBe('entry_id,created_at,transfer_id,currency,amount_minor,balance_after_minor');
  expect(lines.length - 1).toBe(await entryCount(alice));
});

test('unknown account renders not-found', async ({ page }) => {
  await page.goto('/accounts/00000000-0000-4000-8000-000000000000');
  await expect(page.getByRole('heading', { name: 'Not found' })).toBeVisible();
});
