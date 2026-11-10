/** @jest-environment jsdom */
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';

import type { AuthenticatedFetch } from '../data/api-request';
import { DashboardOverviewPage } from './dashboard-overview-page';

function respond(status: number, body: unknown) {
  return Promise.resolve({
    json: () => Promise.resolve(body),
    ok: status >= 200 && status < 300,
    status
  } as Response);
}

const overview = {
  charts: {
    data: {
      kind: 'portfolioValue',
      points: [{ date: '2026-04-01', value: 4100 }]
    },
    status: 'available'
  },
  risk: {
    error: { code: 'DASHBOARD_RISK_UNAVAILABLE', message: 'holdings down' },
    status: 'unavailable'
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

describe('DashboardOverviewPage', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeAll(() => {
    (
      globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
  });

  beforeEach(() => {
    container = document.createElement('div');
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
  });

  async function render(request: jest.Mock) {
    await act(async () => {
      root.render(
        <DashboardOverviewPage
          request={request as unknown as AuthenticatedFetch}
        />
      );
    });
  }

  it('calls the overview route once through the host fetch', async () => {
    const request = jest.fn(() =>
      respond(200, { data: overview, error: null, meta: {} })
    );

    await render(request);

    expect(request).toHaveBeenCalledTimes(1);
    expect(request).toHaveBeenCalledWith(
      '/api/v1/dashboard/overview',
      expect.objectContaining({ method: 'GET' })
    );
  });

  it('shows the available sections and only the failed one as an error', async () => {
    await render(
      jest.fn(() => respond(200, { data: overview, error: null, meta: {} }))
    );

    const text = container.textContent ?? '';

    expect(text).toContain('217.6 USD');
    expect(text).toContain('1 data points · latest 2026-04-01');
    expect(text).toContain('The risk section could not be loaded');
    expect(text).not.toContain('holdings down');
    expect(container.querySelectorAll('[role="alert"]')).toHaveLength(1);
  });

  it('shows a retryable error in every card when the request fails, and retries', async () => {
    const request = jest
      .fn()
      .mockImplementationOnce(() =>
        respond(500, {
          data: null,
          error: { code: 'DASHBOARD_OVERVIEW_FAILED', message: 'x' },
          meta: {}
        })
      )
      .mockImplementation(() =>
        respond(200, { data: overview, error: null, meta: {} })
      );

    await render(request);

    expect(container.querySelectorAll('[role="alert"]')).toHaveLength(3);

    const retry = container.querySelector('button');

    await act(async () => {
      retry?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(request).toHaveBeenCalledTimes(2);
    expect(container.querySelectorAll('[role="alert"]')).toHaveLength(1);
  });
});
