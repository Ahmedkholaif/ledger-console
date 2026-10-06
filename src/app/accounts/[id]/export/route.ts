import { getAccount, listEntries } from '@/lib/ledger';

/**
 * Streams an account's entire journal as CSV.
 *
 * The response is a ReadableStream that walks the ledger's keyset pagination
 * one page at a time, so memory stays flat however long the journal is, and
 * the download starts with the first page instead of waiting for the last.
 * It pulls a page only when the client is ready for more (backpressure).
 */
export async function GET(_req: Request, ctx: RouteContext<'/accounts/[id]/export'>) {
  const { id } = await ctx.params;
  const account = await getAccount(id);
  if (!account) return new Response('account not found', { status: 404 });

  const encoder = new TextEncoder();
  let after = 0;
  let headerSent = false;
  const stream = new ReadableStream<Uint8Array>({
    async pull(controller) {
      if (!headerSent) {
        headerSent = true;
        controller.enqueue(encoder.encode('entry_id,created_at,transfer_id,currency,amount_minor,balance_after_minor\n'));
        return;
      }
      const page = await listEntries(id, after, 500);
      if (page.entries.length === 0) return controller.close();
      const rows = page.entries.map((e) => [e.id, e.created_at, e.transfer_id, e.currency, e.amount, e.balance_after].join(',')).join('\n');
      controller.enqueue(encoder.encode(rows + '\n'));
      after = page.next_after ?? after;
      if (page.entries.length < 500) controller.close();
    },
  });

  const filename = `${account.name.replace(/[^\w.-]+/g, '_')}-journal.csv`;
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  });
}
