import { renderToStaticMarkup } from 'react-dom/server';

import { RealizedGainsTable } from './realized-gains-table';
import type { FifoGainSale, RealizedGainsData } from './realized-gains.client';

const sale: FifoGainSale = {
  allocatedAcquisitionFees: '0.000000000000000001',
  allocatedBuyFees: '0.000000000000000001',
  allocatedSellFee: '0.25',
  currency: null,
  grossCostBasis: '100.000000000000000001',
  grossProceeds: '99',
  grossRealizedGain: '-1.000000000000000001',
  matchedQuantity: '1',
  matches: [],
  realizedGainAfterActivityFees: '-1.250000000000000002',
  sellActivityId: 'sell-b',
  sellDate: '2026-01-01T00:30:00.000Z',
  sellFee: '0.25',
  sellQuantity: '1'
};

function view(data: RealizedGainsData) {
  return renderToStaticMarkup(<RealizedGainsTable data={data} />);
}

describe('RealizedGainsTable', () => {
  it('shows raw Tax values, negative gains, null currency and the UTC date', () => {
    const html = view({ method: 'FIFO', sales: [sale] });

    expect(html).toContain('Realized capital gains (FIFO)');
    expect(html).toContain('2026-01-01');
    expect(html).toContain('Not specified');
    expect(html).toContain('100.000000000000000001');
    expect(html).toContain('-1.000000000000000001');
    expect(html).toContain('-1.250000000000000002');
    expect(html).toContain('0.000000000000000001');
    expect(html).toContain('SELL activity ID');
    expect(html).toContain('Gain after activity fees');
    expect(html).not.toContain('NaN');
  });

  it('sorts sales by date and SELL ID without changing input order', () => {
    const later = {
      ...sale,
      sellActivityId: 'sell-late',
      sellDate: '2026-01-02T00:00:00.000Z'
    };
    const earlyB = { ...sale, sellActivityId: 'sell-b' };
    const earlyA = { ...sale, sellActivityId: 'sell-a' };
    const sales = [later, earlyB, earlyA];
    const html = view({ method: 'FIFO', sales });

    expect(html.indexOf('>sell-a<')).toBeLessThan(html.indexOf('>sell-b<'));
    expect(html.indexOf('>sell-b<')).toBeLessThan(html.indexOf('>sell-late<'));
    expect(sales[0].sellActivityId).toBe('sell-late');
  });

  it('warns about excluded history even with zero returned sales', () => {
    const html = view({
      isComplete: false,
      diagnostics: [
        {
          code: 'TAX_SCOPE_HAS_EXCLUDED_INVESTMENT_HISTORY',
          affectedSellActivityIds: ['sell-b'],
          excludedActivityIds: ['buy-x'],
          message: 'Excluded history may affect basis.'
        }
      ],
      method: 'FIFO',
      sales: []
    });

    expect(html).toContain('role="alert"');
    expect(html).toContain('Tax results may be incomplete');
    expect(html).toContain('Excluded history may affect basis');
    expect(html).toContain('buy-x');
    expect(html).toContain('No sales available in the included history');
    expect(html).not.toContain('No realized sales for FIFO');
  });

  it('warns when completeness is false but diagnostics are not supplied', () => {
    const html = view({ method: 'FIFO', sales: [], isComplete: false });
    expect(html).toContain('No exclusion details were provided');
  });
});
