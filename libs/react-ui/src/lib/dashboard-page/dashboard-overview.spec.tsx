import { renderToStaticMarkup } from 'react-dom/server';

import {
  DASHBOARD_OVERVIEW_PATH,
  toDashboardSections
} from './dashboard-overview';
import type { DashboardOverviewData } from './dashboard-overview';

const overview: DashboardOverviewData = {
  charts: {
    data: {
      kind: 'portfolioValue',
      points: [
        { date: '2026-01-05', value: 3000 },
        { date: '2026-04-01', value: 4100 }
      ]
    },
    status: 'available'
  },
  risk: {
    data: {
      stock: {
        buckets: [
          { name: 'MSFT', percentage: 0.35, severity: 'YELLOW' },
          { name: 'AAPL', percentage: 0.4, severity: 'RED' },
          { name: 'SAP', percentage: 0.25, severity: 'GREEN' }
        ]
      }
    },
    status: 'available'
  },
  tax: {
    data: {
      method: 'FIFO',
      sales: [
        {
          currency: 'USD',
          realizedGainAfterActivityFees: '217.6',
          sellActivityId: 'fixture-order-04',
          sellDate: '2026-03-02T00:00:00.000Z'
        }
      ]
    },
    status: 'available'
  }
};

const html = (node: unknown) =>
  renderToStaticMarkup(node as Parameters<typeof renderToStaticMarkup>[0]);

describe('toDashboardSections', () => {
  it('uses the overview route path', () => {
    expect(DASHBOARD_OVERVIEW_PATH).toBe('/api/v1/dashboard/overview');
  });

  it('renders the risk card from the stock concentration buckets', () => {
    const { risk } = toDashboardSections(overview);

    expect(risk.status).toBe('ready');
    expect(html(risk.content)).toContain('AAPL exceeds the single-stock limit');
    expect(html(risk.content)).toContain('40.0%');
  });

  it('renders the tax card with the exact realized gain', () => {
    const { tax } = toDashboardSections(overview);

    expect(tax.status).toBe('ready');
    expect(html(tax.content)).toContain('217.6 USD');
    expect(html(tax.content)).toContain('1 sale · FIFO');
  });

  it('keeps the charts summary until the charts card lands', () => {
    expect(toDashboardSections(overview).charts).toEqual({
      content: '2 data points · latest 2026-04-01',
      status: 'ready'
    });
  });

  it('turns an unavailable section into a retryable error without server text', () => {
    const onRetry = jest.fn();
    const sections = toDashboardSections(
      {
        ...overview,
        tax: {
          error: {
            code: 'DASHBOARD_TAX_UNAVAILABLE',
            message: 'internal detail'
          },
          status: 'unavailable'
        }
      },
      onRetry
    );

    expect(sections.tax).toEqual({
      errorMessage: 'The tax section could not be loaded',
      onRetry,
      status: 'error'
    });
    expect(JSON.stringify(sections.tax)).not.toContain('internal detail');
    expect(sections.risk.status).toBe('ready');
    expect(sections.charts.status).toBe('ready');
  });

  it('marks sections with no rows empty', () => {
    const sections = toDashboardSections({
      charts: {
        data: { kind: 'portfolioValue', points: [] },
        status: 'available'
      },
      risk: { data: { stock: { buckets: [] } }, status: 'available' },
      tax: { data: { method: 'FIFO', sales: [] }, status: 'available' }
    });

    expect(sections.risk.status).toBe('empty');
    expect(sections.tax.status).toBe('empty');
    expect(sections.charts.status).toBe('empty');
  });
});
