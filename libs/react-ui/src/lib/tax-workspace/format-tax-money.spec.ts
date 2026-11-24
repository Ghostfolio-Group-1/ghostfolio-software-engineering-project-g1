import { formatTaxMoney } from './format-tax-money';

describe('formatTaxMoney', () => {
  it.each([
    ['4611.6', '4,611.60'],
    ['3733.2', '3,733.20'],
    ['371.7', '371.70'],
    ['36.4', '36.40'],
    ['641.55', '641.55'],
    ['0', '0.00'],
    ['0.25', '0.25'],
    ['-1234.567', '-1,234.57'],
    ['3883.7828571428571428571', '3,883.78'],
    ['727.8171428571428571428', '727.82'],
    ['0.000000000000000001', '0.00']
  ])('formats %s as %s', (value, expected) => {
    expect(formatTaxMoney(value)).toBe(expected);
  });

  it('rounds half-up without using floating-point arithmetic', () => {
    expect(formatTaxMoney('1.005')).toBe('1.01');
    expect(formatTaxMoney('-1.005')).toBe('-1.01');
    expect(formatTaxMoney('999.995')).toBe('1,000.00');
  });

  it('preserves precision beyond JavaScript safe integer limits', () => {
    expect(formatTaxMoney('9007199254740993.125')).toBe(
      '9,007,199,254,740,993.13'
    );
  });

  it('does not display negative zero', () => {
    expect(formatTaxMoney('-0.001')).toBe('0.00');
    expect(formatTaxMoney('-0.000')).toBe('0.00');
  });

  it('distinguishes unavailable amounts from known zero', () => {
    expect(formatTaxMoney(null)).toBe('Not available');
    expect(formatTaxMoney('0')).toBe('0.00');
  });

  it.each(['', 'NaN', 'Infinity', 'abc', '1,234.56', '1e3'])(
    'does not display invalid decimal input: %s',
    (value) => {
      expect(formatTaxMoney(value)).toBe('Not available');
    }
  );
});
