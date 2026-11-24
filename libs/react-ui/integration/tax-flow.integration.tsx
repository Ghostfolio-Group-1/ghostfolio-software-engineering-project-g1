import type { ReactElement } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';

import { RealizedGainsScreen } from '../src/lib/realized-gains/realized-gains-screen';
import { fetchRealizedGains } from '../src/lib/realized-gains/realized-gains.client';
import { fetchTaxLots } from '../src/lib/tax-lots/use-tax-lots';
import { YearlyTaxSummaryScreen } from '../src/lib/yearly-tax-summary/yearly-tax-summary-screen';
import {
  createYearlyTaxSummaryLoader,
  parseYearlyTaxSummary
} from '../src/lib/yearly-tax-summary/yearly-tax-summary.client';
import {
  createIntegrationSession,
  fixture,
  INTEGRATION_API_URL
} from './api-session';
import type { IntegrationSession } from './api-session';

// This suite requires Raniya's running demo API and seeded, per-run portfolio.
// Without INTEGRATION_API_URL it is skipped; a skipped run is not live evidence.
const describeLive = INTEGRATION_API_URL ? describe : describe.skip;

const EXPECTED = {
  acquiredQuantity: '10',
  allocatedAcquisitionFees: '0.4',
  allocatedFees: '1.4',
  costBasis: '400',
  grossGain: '80',
  otherLotQuantity: '5',
  proceeds: '480',
  remainingQuantity: '6',
  sellFee: '1',
  soldQuantity: '4'
} as const;

describeLive(
  'Tax lots, realized gains, and yearly summary against the real API',
  () => {
    let container: HTMLDivElement;
    let root: Root;
    let session: IntegrationSession;

    beforeAll(async () => {
      (
        globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
      ).IS_REACT_ACT_ENVIRONMENT = true;

      // Imports the existing, synthetic USD fixture into a fresh test user.
      session = await createIntegrationSession(INTEGRATION_API_URL as string);
    });

    beforeEach(() => {
      container = document.createElement('div');
      document.body.appendChild(container);
      root = createRoot(container);
    });

    afterEach(() => {
      if (root) {
        act(() => root.unmount());
      }

      container?.remove();
    });

    async function render(element: ReactElement) {
      await act(async () => {
        root.render(element);
      });
    }

    async function settled() {
      for (let attempt = 0; attempt < 100; attempt++) {
        if (!container.querySelector('[aria-busy="true"]')) {
          break;
        }

        await act(async () => {
          await new Promise((resolve) => setTimeout(resolve, 100));
        });
      }

      expect(container.querySelector('[aria-busy="true"]')).toBeNull();
    }

    function gainCell(columnLabel: string): string | null | undefined {
      const headers = Array.from(container.querySelectorAll('table thead th'));
      const index = headers.findIndex(
        (header) => header.textContent?.trim() === columnLabel
      );

      expect(index).toBeGreaterThanOrEqual(0);

      const cells = container.querySelectorAll('table tbody tr:first-child td');
      expect(cells.length).toBe(headers.length);

      return cells[index]?.textContent?.trim();
    }

    function annualTotal(label: string): string | null | undefined {
      const row = Array.from(container.querySelectorAll('dl > div')).find(
        (item) => item.querySelector('dt')?.textContent?.trim() === label
      );

      expect(row).toBeDefined();
      return row?.querySelector('dd')?.textContent?.trim();
    }

    it('traces one unassigned-account sale through its FIFO lot, realized gain, and annual summary', async () => {
      const lots = await fetchTaxLots(session.request);
      const gains = await fetchRealizedGains(session.request, 'FIFO');
      const year = fixture.expected.dividendYear;
      const summary = parseYearlyTaxSummary(
        await createYearlyTaxSummaryLoader(session.request)({
          method: 'FIFO',
          signal: new AbortController().signal,
          year
        }),
        year,
        'FIFO'
      );

      expect(lots.lots).toHaveLength(2);
      expect(gains.method).toBe('FIFO');
      if (gains.method !== 'FIFO') {
        throw new Error(
          'The live realized-gains endpoint returned the wrong method'
        );
      }

      expect(gains.sales).toHaveLength(1);
      const sale = gains.sales[0];
      expect(sale).toEqual(
        expect.objectContaining({
          allocatedAcquisitionFees: EXPECTED.allocatedAcquisitionFees,
          allocatedSellFee: EXPECTED.sellFee,
          currency: 'USD',
          grossCostBasis: EXPECTED.costBasis,
          grossProceeds: EXPECTED.proceeds,
          grossRealizedGain: EXPECTED.grossGain,
          matchedQuantity: EXPECTED.soldQuantity,
          realizedGainAfterActivityFees:
            fixture.expected.realizedGainAfterActivityFees,
          sellQuantity: EXPECTED.soldQuantity
        })
      );

      expect(sale.matches).toHaveLength(1);
      const match = sale.matches[0];
      expect(match).toEqual(
        expect.objectContaining({
          grossAcquisitionValue: EXPECTED.costBasis,
          grossProceeds: EXPECTED.proceeds,
          grossRealizedGain: EXPECTED.grossGain,
          matchedQuantity: EXPECTED.soldQuantity,
          sellActivityId: sale.sellActivityId
        })
      );

      const consumedLot = lots.lots.find((lot) => lot.lotId === match.lotId);
      expect(consumedLot).toEqual(
        expect.objectContaining({
          accountId: null,
          consumedQuantity: EXPECTED.soldQuantity,
          originalQuantity: EXPECTED.acquiredQuantity,
          remainingQuantity: EXPECTED.remainingQuantity,
          status: 'PARTIALLY_CONSUMED'
        })
      );
      expect(consumedLot?.sourceActivityId).toBe(match.buyActivityId);
      expect(consumedLot?.relatedSellActivityIds).toContain(
        sale.sellActivityId
      );

      // The other asset is still open; this is an asset-isolation check,
      // not an unsupported claim of cross-user isolation.
      const otherLot = lots.lots.find((lot) => lot.lotId !== match.lotId);
      expect(otherLot).toEqual(
        expect.objectContaining({
          accountId: null,
          consumedQuantity: '0',
          originalQuantity: EXPECTED.otherLotQuantity,
          remainingQuantity: EXPECTED.otherLotQuantity,
          status: 'OPEN'
        })
      );
      expect(otherLot?.symbolProfileId).not.toBe(consumedLot?.symbolProfileId);

      expect(summary).toEqual(
        expect.objectContaining({
          baseCurrency: 'USD',
          disposalCount: 1,
          grossCostBasisBaseCurrency: EXPECTED.costBasis,
          grossProceedsBaseCurrency: EXPECTED.proceeds,
          grossRealizedGainBaseCurrency: EXPECTED.grossGain,
          method: 'FIFO',
          realizedGainAfterActivityFeesBaseCurrency:
            fixture.expected.realizedGainAfterActivityFees,
          totalActivityFeesBaseCurrency: EXPECTED.allocatedFees,
          year
        })
      );
      expect(summary.realizedGains).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            grossCostBasis: EXPECTED.costBasis,
            grossProceeds: EXPECTED.proceeds,
            grossRealizedGain: EXPECTED.grossGain,
            sellActivityId: sale.sellActivityId
          })
        ])
      );
      expect(summary.currencySummaries).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            allocatedFees: EXPECTED.allocatedFees,
            currency: 'USD',
            grossCostBasis: EXPECTED.costBasis,
            grossProceeds: EXPECTED.proceeds,
            grossRealizedGain: EXPECTED.grossGain,
            realizedGainAfterActivityFees:
              fixture.expected.realizedGainAfterActivityFees
          })
        ])
      );

      // The synthetic DIVIDEND has no known withholding. Unknown is not zero.
      expect(summary.dividendCount).toBe(1);
      expect(summary.grossDividendsBaseCurrency).toBe('3');
      expect(summary.totalWithholdingTaxBaseCurrency).toBeNull();
      expect(summary.netDividendsBaseCurrency).toBeNull();
      expect(summary.isComplete).toBe(false);
      expect(summary.warnings).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ code: 'UNKNOWN_DIVIDEND_WITHHOLDING' })
        ])
      );
    });

    it('renders formatted live realized-gain values in the React table', async () => {
      await render(<RealizedGainsScreen request={session.request} />);
      await settled();

      expect(container.querySelector('[role="alert"]')).toBeNull();

      expect(gainCell('Gross proceeds')).toBe('480.00');
      expect(gainCell('Gross cost basis')).toBe('400.00');
      expect(gainCell('Gross realized gain')).toBe('80.00');
      expect(gainCell('Allocated acquisition fees')).toBe('0.40');
      expect(gainCell('Allocated sell fee')).toBe('1.00');
      expect(gainCell('Gain after activity fees')).toBe('78.60');
    });

    it('renders formatted live yearly totals and marks unknown withholding unavailable, not zero', async () => {
      await render(
        <YearlyTaxSummaryScreen
          initialYear={fixture.expected.dividendYear}
          load={createYearlyTaxSummaryLoader(session.request)}
        />
      );

      await settled();

      expect(container.textContent).toContain('Disposals: 1.');
      expect(annualTotal('Gross proceeds')).toBe('480.00');
      expect(annualTotal('Gross cost basis')).toBe('400.00');
      expect(annualTotal('Gross realized gain')).toBe('80.00');
      expect(annualTotal('Realized gain after activity fees')).toBe('78.60');
      expect(annualTotal('Total activity fees')).toBe('1.40');
      expect(annualTotal('Gross dividends')).toBe('3.00');

      expect(annualTotal('Withholding tax')).toBe('Not available');
      expect(annualTotal('Net dividends')).toBe('Not available');

      expect(container.querySelector('[role="alert"]')).not.toBeNull();

      expect(container.textContent).toContain(
        'One or more dividend activities have unknown withholding tax, so complete withholding and net-dividend totals are unavailable.'
      );

      expect(container.textContent).not.toContain(
        'UNKNOWN_DIVIDEND_WITHHOLDING'
      );

      expect(container.textContent).not.toContain(
        `No Tax activities for ${fixture.expected.dividendYear}`
      );
    });
  }
);
