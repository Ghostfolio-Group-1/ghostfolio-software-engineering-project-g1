/** @jest-environment jsdom */
import { renderToStaticMarkup } from 'react-dom/server';

import { YearlyTaxSummaryTable } from './yearly-tax-summary-table';
import type { YearlyTaxSummaryData } from './yearly-tax-summary.client';

const summary: YearlyTaxSummaryData = {
  baseCurrency: 'USD',
  calculatedAt: '2026-11-09T12:00:00.000Z',
  currencySummaries: [
    {
      allocatedFees: '0',
      currency: 'EUR',
      grossCostBasis: '25',
      grossProceeds: '30',
      grossRealizedGain: '5',
      realizedGainAfterActivityFees: '5',
      totalGrossDividends: '2.1',
      totalNetDividends: null,
      totalWithholdingTax: null
    }
  ],
  dividendCount: 1,
  dividendRecords: [],
  disposalCount: 1,
  errors: [
    {
      code: 'MISSING_DIVIDEND_BASE_CURRENCY_CONVERSION',
      message: 'Historical FX rate is unavailable.',
      sourceActivityIds: ['dividend-1']
    }
  ],
  grossCostBasisBaseCurrency: '25',
  grossDividendsBaseCurrency: null,
  grossProceedsBaseCurrency: '30',
  grossRealizedGainBaseCurrency: '5',
  isComplete: false,
  method: 'FIFO',
  netDividendsBaseCurrency: null,
  realizedGainAfterActivityFeesBaseCurrency: '4.999999999999999999',
  realizedGains: [],
  totalActivityFeesBaseCurrency: '0.000000000000000001',
  totalWithholdingTaxBaseCurrency: null,
  warnings: [
    {
      code: 'UNKNOWN_DIVIDEND_WITHHOLDING',
      message: 'Unknown withholding.',
      sourceActivityIds: ['dividend-1']
    }
  ],
  year: 2026
};

describe('YearlyTaxSummaryTable', () => {
  it('formats authoritative totals without changing precision or replacing missing data with zero', () => {
    const html = renderToStaticMarkup(
      <YearlyTaxSummaryTable summary={summary} />
    );

    expect(html).toContain('Yearly Tax summary');
    expect(html).toContain('2026-11-09');

    expect(html).toContain('<dt>Gross proceeds</dt><dd>30.00</dd>');
    expect(html).toContain('<dt>Gross cost basis</dt><dd>25.00</dd>');
    expect(html).toContain('<dt>Total activity fees</dt><dd>0.00</dd>');
    expect(html).toContain(
      '<dt>Realized gain after activity fees</dt><dd>5.00</dd>'
    );

    expect(html).toContain('<dt>Gross dividends</dt><dd>Not available</dd>');
    expect(html).toContain('<dt>Withholding tax</dt><dd>Not available</dd>');
    expect(html).toContain('<dt>Net dividends</dt><dd>Not available</dd>');

    expect(html).toContain('>2.10<');
    expect(html).toContain('EUR');
    expect(html).toContain('USD');
    expect(html).toContain('Gross realized gain');
    expect(html).toContain('for display only');

    // Original values retain their full decimal precision.
    expect(summary.totalActivityFeesBaseCurrency).toBe('0.000000000000000001');
    expect(summary.realizedGainAfterActivityFeesBaseCurrency).toBe(
      '4.999999999999999999'
    );
    expect(summary.grossDividendsBaseCurrency).toBeNull();
    expect(summary.netDividendsBaseCurrency).toBeNull();
    expect(summary.totalWithholdingTaxBaseCurrency).toBeNull();
  });

  it('renders incomplete diagnostics instead of pretending totals are complete', () => {
    const html = renderToStaticMarkup(
      <YearlyTaxSummaryTable summary={summary} />
    );

    expect(html).toContain('role="alert"');
    expect(html).toContain('This yearly Tax summary is incomplete');
    expect(html).toContain('Historical FX rate is unavailable.');
    expect(html).toContain('Unknown withholding.');
    expect(html).toContain('An unavailable amount is not zero.');
  });

  it('renders a complete result without a warning banner', () => {
    const html = renderToStaticMarkup(
      <YearlyTaxSummaryTable
        summary={{
          ...summary,
          errors: [],
          isComplete: true,
          warnings: []
        }}
      />
    );

    expect(html).not.toContain('role="alert"');
  });

  // Regression test for Issue #344: money formatting.
  it('formats annual and transaction-currency amounts without changing source data', () => {
    const formattedSummary: YearlyTaxSummaryData = {
      ...summary,
      method: 'AVERAGE_COST',
      grossProceedsBaseCurrency: '4611.6',
      grossCostBasisBaseCurrency: '3883.7828571428571428571',
      grossRealizedGainBaseCurrency: '727.8171428571428571428',
      totalActivityFeesBaseCurrency: '0',
      currencySummaries: [
        {
          ...summary.currencySummaries[0],
          totalGrossDividends: '371.7',
          totalWithholdingTax: '36.4',
          totalNetDividends: '335.3',
          grossRealizedGain: '1234.56789',
          allocatedFees: '0.125',
          realizedGainAfterActivityFees: '1234.44289'
        }
      ]
    };

    const originalSummary = {
      ...formattedSummary,
      currencySummaries: formattedSummary.currencySummaries.map((row) => ({
        ...row
      }))
    };

    const html = renderToStaticMarkup(
      <YearlyTaxSummaryTable summary={formattedSummary} />
    );

    // Annual base-currency amounts.
    expect(html).toContain('>4,611.60<');
    expect(html).toContain('>3,883.78<');
    expect(html).toContain('>727.82<');

    // Transaction-currency amounts.
    expect(html).toContain('>371.70<');
    expect(html).toContain('>36.40<');
    expect(html).toContain('>335.30<');
    expect(html).toContain('>1,234.57<');
    expect(html).toContain('>0.13<');
    expect(html).toContain('>1,234.44<');

    expect(html).toContain('>0.00<');
    expect(html).toContain('Not available');
    expect(html).toContain('AVERAGE_COST');
    expect(html).toContain('EUR');
    expect(html).toContain('USD');

    expect(html).not.toContain('>4611.6<');
    expect(html).not.toContain('NaN');

    expect(formattedSummary).toEqual(originalSummary);
  });

  // Regression test for Issue #344: diagnostic readability.
  it('shows readable diagnostic messages without exposing raw codes as text', () => {
    const html = renderToStaticMarkup(
      <YearlyTaxSummaryTable summary={summary} />
    );

    expect(html).toContain('role="alert"');
    expect(html).toContain('This yearly Tax summary is incomplete');
    expect(html).toContain('Historical FX rate is unavailable.');
    expect(html).toContain('Unknown withholding.');

    expect(html).not.toContain('MISSING_DIVIDEND_BASE_CURRENCY_CONVERSION');
    expect(html).not.toContain('UNKNOWN_DIVIDEND_WITHHOLDING');

    // Internal codes remain available in the original API data.
    expect(summary.errors[0].code).toBe(
      'MISSING_DIVIDEND_BASE_CURRENCY_CONVERSION'
    );
    expect(summary.warnings[0].code).toBe('UNKNOWN_DIVIDEND_WITHHOLDING');
  });
});
