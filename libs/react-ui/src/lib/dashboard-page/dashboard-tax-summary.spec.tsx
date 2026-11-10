import { renderToStaticMarkup } from 'react-dom/server';

import {
  DashboardTaxSummary,
  totalRealizedGain
} from './dashboard-tax-summary';

const sale = (id: string, date: string, gain: string, currency = 'USD') => ({
  currency,
  realizedGainAfterActivityFees: gain,
  sellActivityId: id,
  sellDate: `${date}T00:00:00.000Z`
});

describe('totalRealizedGain', () => {
  it('adds decimal strings exactly', () => {
    expect(
      totalRealizedGain([
        sale('a', '2026-01-01', '0.1'),
        sale('b', '2026-02-01', '0.2'),
        sale('c', '2026-03-01', '198.16666666666666666667')
      ])
    ).toEqual({ currency: 'USD', total: '198.46666666666666666667' });
  });

  it('handles losses', () => {
    expect(
      totalRealizedGain([
        sale('a', '2026-01-01', '217.6'),
        sale('b', '2026-02-01', '-17.6')
      ])
    ).toEqual({ currency: 'USD', total: '200' });
  });

  it('refuses to add different currencies', () => {
    expect(
      totalRealizedGain([
        sale('a', '2026-01-01', '10'),
        sale('b', '2026-02-01', '10', 'EUR')
      ])
    ).toBeNull();
  });
});

describe('DashboardTaxSummary', () => {
  it('shows the exact total, the sale count and the method', () => {
    const html = renderToStaticMarkup(
      <DashboardTaxSummary
        method="FIFO"
        sales={[
          sale('a', '2026-01-01', '217.6'),
          sale('b', '2026-02-01', '0.4')
        ]}
      />
    );

    expect(html).toContain('<strong>218 USD</strong>');
    expect(html).toContain('2 sales · FIFO');
  });

  it('lists the most recent sales first with their decimal strings unchanged', () => {
    const html = renderToStaticMarkup(
      <DashboardTaxSummary
        limit={2}
        method="FIFO"
        sales={[
          sale('old', '2026-01-01', '1'),
          sale('new', '2026-03-01', '19.43333333333333333333'),
          sale('mid', '2026-02-01', '2')
        ]}
      />
    );

    expect(html.indexOf('2026-03-01')).toBeLessThan(html.indexOf('2026-02-01'));
    expect(html).not.toContain('2026-01-01');
    expect(html).toContain('19.43333333333333333333 USD');
  });

  it('shows "Mixed currencies" instead of a wrong total', () => {
    const html = renderToStaticMarkup(
      <DashboardTaxSummary
        method="FIFO"
        sales={[
          sale('a', '2026-01-01', '10'),
          sale('b', '2026-02-01', '10', 'EUR')
        ]}
      />
    );

    expect(html).toContain('Mixed currencies');
  });
});
