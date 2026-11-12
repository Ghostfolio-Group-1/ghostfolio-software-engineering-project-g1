/** @jest-environment jsdom */
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';

import type { AuthenticatedFetch } from '../data/api-request';
import { RiskWarningsPage } from './risk-warnings-page';

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

const warning = {
  actual: 0.33,
  message: 'AAPL is 33% of your portfolio, above the 25% red limit.',
  ruleKey: 'SingleStockConcentration',
  severity: 'RED',
  subject: { type: 'stock', value: 'AAPL' },
  threshold: 0.25
};

describe('RiskWarningsPage', () => {
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
      root.render(<RiskWarningsPage request={request} />);
    });
  }

  it('fetches /risk/warnings and renders the live list', async () => {
    const request = jest
      .fn()
      .mockResolvedValue(httpResponse(okEnvelope([warning])));

    await render(request as unknown as AuthenticatedFetch);

    expect(request).toHaveBeenCalledWith(
      '/api/v1/risk/warnings?pageSize=100',
      expect.objectContaining({ method: 'GET' })
    );
    expect(container.textContent).toContain('Stock: AAPL');
    expect(container.textContent).toContain(warning.message);
  });

  it('shows the empty state when there are no warnings', async () => {
    const request = jest.fn().mockResolvedValue(httpResponse(okEnvelope([])));

    await render(request as unknown as AuthenticatedFetch);

    expect(container.textContent).toContain('No active warnings');
  });

  it('shows a generic error message and retries on request', async () => {
    let shouldFail = true;
    const request = jest.fn().mockImplementation(() => {
      if (shouldFail) {
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

      return Promise.resolve(httpResponse(okEnvelope([warning])));
    });

    await render(request as unknown as AuthenticatedFetch);

    expect(container.textContent).toContain(
      'Warnings are unavailable right now'
    );
    expect(container.textContent).not.toContain('boom');

    shouldFail = false;
    const retry = container.querySelector('button');

    await act(async () => {
      retry?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(container.textContent).toContain('Stock: AAPL');
  });
});
