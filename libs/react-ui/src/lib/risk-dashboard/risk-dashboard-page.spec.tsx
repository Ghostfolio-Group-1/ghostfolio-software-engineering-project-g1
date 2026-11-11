/** @jest-environment jsdom */
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';

import type { AuthenticatedFetch } from '../data/api-request';
import { ThemeProvider } from '../theme/theme-provider';
import { RiskDashboardPage } from './risk-dashboard-page';

function httpResponse(body: unknown, status = 200): Response {
  return {
    json: jest.fn().mockResolvedValue(body),
    ok: status >= 200 && status < 300,
    status
  } as unknown as Response;
}

function okEnvelope(data: unknown) {
  return { data, error: null, meta: {} };
}

const scoreBody = okEnvelope({
  categories: [],
  grade: 'A',
  score: 95,
  severity: 'GREEN',
  unavailableReason: null
});

const concentrationBody = okEnvelope({ stock: { buckets: [] } });

describe('RiskDashboardPage', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (
      globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  async function render(request: AuthenticatedFetch) {
    await act(async () => {
      root.render(
        <ThemeProvider>
          <RiskDashboardPage request={request} />
        </ThemeProvider>
      );
    });
  }

  it('fetches both routes and renders the live score and grade', async () => {
    const request = jest.fn().mockImplementation((url: string) => {
      if (url.includes('/risk/concentration')) {
        return Promise.resolve(httpResponse(concentrationBody));
      }

      return Promise.resolve(httpResponse(scoreBody));
    }) as unknown as AuthenticatedFetch;

    await render(request);

    expect(request).toHaveBeenCalledWith(
      '/api/v1/risk/score',
      expect.objectContaining({ method: 'GET' })
    );
    expect(request).toHaveBeenCalledWith(
      '/api/v1/risk/concentration',
      expect.objectContaining({ method: 'GET' })
    );
    expect(container.textContent).toContain('Grade A');
    expect(
      container.querySelector('[data-testid="risk-score-value"]')
    ).not.toBeNull();
  });

  it('shows a generic error message and retries on request', async () => {
    let scoreShouldFail = true;
    const request = jest.fn().mockImplementation((url: string) => {
      if (url.includes('/risk/concentration')) {
        return Promise.resolve(httpResponse(concentrationBody));
      }

      if (scoreShouldFail) {
        return Promise.resolve(
          httpResponse(
            {
              data: null,
              error: { code: 'RISK_CALC_FAILED', message: 'boom' },
              meta: {}
            },
            500
          )
        );
      }

      return Promise.resolve(httpResponse(scoreBody));
    }) as unknown as AuthenticatedFetch;

    await render(request);

    expect(container.textContent).toContain(
      'Unable to calculate your risk score right now'
    );
    expect(container.textContent).not.toContain('boom');

    scoreShouldFail = false;
    const retry = container.querySelector('button');

    await act(async () => {
      retry?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(container.textContent).toContain('Grade A');
  });
});
