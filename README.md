# ledger-console

[![ci](https://github.com/Ahmedkholaif/ledger-console/actions/workflows/ci.yml/badge.svg)](https://github.com/Ahmedkholaif/ledger-console/actions/workflows/ci.yml)
![Next.js](https://img.shields.io/badge/Next.js-16-000000?logo=nextdotjs&logoColor=white)
![React](https://img.shields.io/badge/React-19-149ECA?logo=react&logoColor=white)

An **operator console for a double-entry ledger**, built with the Next.js 16 App Router. It runs on top of **either** ledger backend, [ledgerd](https://github.com/Ahmedkholaif/ledgerd) (Go) or [ledger-nest](https://github.com/Ahmedkholaif/ledger-nest) (NestJS), because they share one API. CI runs the full browser test suite against both.

You can browse accounts, read journals, move money, open accounts and export statements, with a live "books balanced" reconciliation badge.

## What Next.js brings

| Next.js feature | How it's used |
|---|---|
| **Cache Components + Partial Prerendering** | Each page's shell (layout, headings, form frames, skeletons) is **prerendered at build time** and served instantly, while live data streams into `<Suspense>` holes per request. The build runs in CI **with no API reachable**, to prove nothing live is baked in. |
| **`"use cache"` with lifetimes and tags** | Account reads are cached for seconds (`cacheLife`) and tagged per account (`cacheTag`). **Transfers are immutable**, so they're cached with `cacheLife('max')`. Journal pages are never cached. |
| **Server Actions + `updateTag`** | Moving money is a server action. Afterwards it expires *exactly* the tags it touched (both accounts, the list, the audit), so the next render shows the new balances: read-your-own-writes without blanket revalidation. |
| **Server Components** | Tables, balances and the audit badge render on the server with zero client JavaScript. The ledger URL and API key live in a `server-only` module and never reach the browser. |
| **`useActionState`** | Forms get pending states and server-side validation with **zod**, and errors restore what the user typed after React's automatic form reset. |
| **Route Handler streaming** | `/accounts/[id]/export` streams the whole journal as CSV with a pull-based `ReadableStream` over keyset pagination. Memory stays flat, the download starts immediately, and backpressure is respected. |
| **Async `params` / `searchParams`, `notFound()`, `error.tsx`** | These handle dynamic routes, cursor pagination (`?after=`), and friendly not-found and backend-down states. |
| **`output: 'standalone'`** | Produces a minimal Docker image that contains only the files the server needs. |

## Double-submit safety, end to end

The transfer form mints an **idempotency key in the browser** on first submit and keeps it until a transfer succeeds. A double-click, an impatient second submit or a network retry all reuse the key, so the backend applies the movement **once** and replays the original result for the rest. The UI then says *"Already processed: replayed the original transfer"*.

The Playwright suite proves it: it fires `requestSubmit()` twice in the same tick, then checks with the ledger API that the money moved exactly once.

## Money is never a float

`src/lib/money.ts` converts between typed decimals and integer minor units using **string and BigInt arithmetic only**, with per-currency precision from `Intl` (USD 2, JPY 0, KWD 3). Inputs like `0.29` and `4.35`, which break naive float maths, are covered by unit tests, as is the largest exactly-representable amount.

## Tests

- **Unit (Vitest):** 24 cases for money parsing and formatting.
- **E2E (Playwright, real browser, real backend):**
  - a transfer shows up instantly (`updateTag`)
  - a double submit moves money once
  - insufficient funds keeps the form input
  - the account journal streams, and the CSV export matches the journal
  - an unknown account renders not-found
- **CI:** typecheck, lint, unit tests, an offline build, then the E2E suite in a **matrix against ledgerd and ledger-nest**.

## Run

```bash
docker compose up --build          # Postgres + ledgerd + console → http://localhost:3000
```

Or point it at any running backend:

```bash
LEDGER_API_URL=http://localhost:8080 npm run dev
# LEDGER_API_KEY=... if ledger-nest runs with API_KEY set
```

E2E: `LEDGER_API_URL=http://localhost:8080 npm run build && npm run test:e2e`
