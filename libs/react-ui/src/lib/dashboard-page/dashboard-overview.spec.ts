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
          { name: 'AAPL', percentage: 40 },
          { name: 'MSFT', percentage: 35 },
          { name: 'SAP', percentage: 25 }
        ]
      }
    },
    status: 'available'
  },
  tax: {
    data: {
      method: 'FIFO',
      sales: [{ realizedGainAfterActivityFees: '217.6' }]
    },
    status: 'available'
  }
};

describe('toDashboardSections', () => {
  it('uses the overview route path', () => {
    expect(DASHBOARD_OVERVIEW_PATH).toBe('/api/v1/dashboard/overview');
  });

  it('marks every available section ready with its summary', () => {
    const sections = toDashboardSections(overview);

    expect(sections.risk).toEqual({
      content: '3 holdings in the risk breakdown',
      status: 'ready'
    });
    expect(sections.tax).toEqual({
      content: '1 realized sales (FIFO)',
      status: 'ready'
    });
    expect(sections.charts).toEqual({
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
