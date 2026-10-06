import { describe, expect, test } from 'vitest';
import { currencyDigits, formatMoney, parseAmount } from './money';

describe('parseAmount', () => {
  test.each([
    ['25', 'USD', 2500],
    ['25.5', 'USD', 2550],
    ['1,250.05', 'USD', 125005],
    ['0.01', 'USD', 1],
    ['1500', 'JPY', 1500],
    ['1.234', 'KWD', 1234],
    // values that break naive float math
    ['0.29', 'USD', 29],
    ['4.35', 'USD', 435],
    ['90071992547409.91', 'USD', 9007199254740991],
  ])('%s %s → %d', (input, cur, want) => {
    expect(parseAmount(input, cur)).toBe(want);
  });

  test.each(['', 'abc', '-5', '0', '0.00', '1.001', '1e3', '12.3.4', '90071992547409.92'])('rejects %j', (input) => {
    expect(parseAmount(input, 'USD')).toBeNull();
  });

  test('respects currency precision', () => {
    expect(parseAmount('1.5', 'JPY')).toBeNull();
    expect(currencyDigits('JPY')).toBe(0);
    expect(currencyDigits('USD')).toBe(2);
  });
});

describe('formatMoney', () => {
  test.each([
    [125050, 'USD', '$1,250.50'],
    [-7, 'USD', '-$0.07'],
    [0, 'EUR', '€0.00'],
    [1500, 'JPY', '¥1,500'],
    [9007199254740991, 'USD', '$90,071,992,547,409.91'],
  ])('%d %s → %s', (minor, cur, want) => {
    expect(formatMoney(minor, cur)).toBe(want);
  });
});
