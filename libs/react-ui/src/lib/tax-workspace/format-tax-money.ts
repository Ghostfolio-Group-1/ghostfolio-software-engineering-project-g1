import { Big } from 'big.js';

/**
 * Formats an authoritative Tax decimal string for display only.
 *
 * Uses two decimal places, half-up rounding and thousands separators.
 * Never converts financial amounts into JavaScript floating-point numbers.
 * Missing values remain unavailable rather than becoming zero.
 */
export function formatTaxMoney(value: string | null): string {
  if (value === null || !/^-?\d+(\.\d+)?$/.test(value)) {
    return 'Not available';
  }

  const rounded = new Big(value).toFixed(2, Big.roundHalfUp);

  // Avoid displaying negative zero after rounding.
  const normalized = rounded === '-0.00' ? '0.00' : rounded;

  const [integer, fraction] = normalized.split('.');

  const grouped = integer.replace(/\B(?=(\d{3})+(?!\d))/g, ',');

  return `${grouped}.${fraction}`;
}
