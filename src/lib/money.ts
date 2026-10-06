// Money crosses the wire as integer minor units (cents). These helpers convert
// between that and what people type and read, using string arithmetic only:
// no floating point ever touches an amount.

/** Number of minor-unit digits for a currency (USD 2, JPY 0, KWD 3). */
export function currencyDigits(currency: string): number {
  try {
    return new Intl.NumberFormat('en', { style: 'currency', currency }).resolvedOptions().maximumFractionDigits ?? 2;
  } catch {
    return 2;
  }
}

/**
 * Parses a user-entered decimal ("1,250.5") into minor units (125050).
 * Returns null for anything that isn't a positive amount representable in
 * the currency's precision.
 */
export function parseAmount(input: string, currency: string): number | null {
  const digits = currencyDigits(currency);
  const s = input.trim().replace(/,/g, '');
  const m = /^(\d+)(?:\.(\d*))?$/.exec(s);
  if (!m) return null;
  const [, whole, frac = ''] = m;
  if (frac.length > digits) return null;
  const minor = BigInt(whole) * 10n ** BigInt(digits) + BigInt(frac.padEnd(digits, '0') || '0');
  if (minor <= 0n || minor > BigInt(Number.MAX_SAFE_INTEGER)) return null;
  return Number(minor);
}

/** Formats minor units for display: formatMoney(-125050, 'USD') → "-$1,250.50". */
export function formatMoney(minor: number, currency: string): string {
  const digits = currencyDigits(currency);
  const sign = minor < 0 ? '-' : '';
  const abs = BigInt(Math.abs(minor));
  const scale = 10n ** BigInt(digits);
  const whole = abs / scale;
  const frac = (abs % scale).toString().padStart(digits, '0');
  const parts = new Intl.NumberFormat('en', { style: 'currency', currency, currencyDisplay: 'narrowSymbol' }).formatToParts(0);
  const symbol = parts.find((p) => p.type === 'currency')?.value ?? currency;
  const symbolFirst = parts.findIndex((p) => p.type === 'currency') < parts.findIndex((p) => p.type === 'integer');
  const num = whole.toLocaleString('en') + (digits ? `.${frac}` : '');
  return sign + (symbolFirst ? `${symbol}${num}` : `${num} ${symbol}`);
}
