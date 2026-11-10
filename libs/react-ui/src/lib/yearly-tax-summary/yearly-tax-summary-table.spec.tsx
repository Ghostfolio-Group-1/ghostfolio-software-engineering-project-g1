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
  it('renders authoritative totals without rounding or replacing missing data with zero', () => {
    const html = renderToStaticMarkup(
      <YearlyTaxSummaryTable summary={summary} />
    );

    expect(html).toContain('Yearly Tax summary');
    expect(html).toContain('2026-11-09');
    expect(html).toContain('0.000000000000000001');
    expect(html).toContain('4.999999999999999999');
    expect(html).toContain('Not available');
    expect(html).toContain('EUR');
    expect(html).toContain('USD');
    expect(html).toContain('Gross realized gain');
  });

  it('renders incomplete diagnostics instead of pretending totals are complete', () => {
    const html = renderToStaticMarkup(
      <YearlyTaxSummaryTable summary={summary} />
    );
    expect(html).toContain('role="alert"');
    expect(html).toContain('MISSING_DIVIDEND_BASE_CURRENCY_CONVERSION');
    expect(html).toContain('UNKNOWN_DIVIDEND_WITHHOLDING');
    expect(html).toContain('Historical FX rate is unavailable');
  });

  it('renders a complete result without a warning banner', () => {
    const html = renderToStaticMarkup(
      <YearlyTaxSummaryTable
        summary={{ ...summary, errors: [], isComplete: true, warnings: [] }}
      />
    );
    expect(html).not.toContain('role="alert"');
  });
});
