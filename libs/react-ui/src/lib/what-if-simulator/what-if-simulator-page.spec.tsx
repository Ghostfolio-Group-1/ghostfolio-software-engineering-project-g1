/** @jest-environment jsdom */
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';

import type { AuthenticatedFetch } from '../data/api-request';
import { WhatIfSimulatorPage } from './what-if-simulator-page';

function respond(status: number, body: unknown) {
  return Promise.resolve({
    json: () => Promise.resolve(body),
    ok: status >= 200 && status < 300,
    status
  } as Response);
}

const HOLDINGS_URL = '/api/v1/portfolio/holdings?holdingType=ACTIVE';

// PortfolioController's GET /portfolio/holdings answers with { holdings }
// directly (no { data, error, meta } envelope), identity nested under
// assetProfile - see fetchWhatIfHoldingOptions.
const oneHolding = {
  holdings: [
    {
      assetProfile: { dataSource: 'YAHOO', name: 'Apple Inc.', symbol: 'AAPL' },
      quantity: 100
    }
  ]
};

const whatIfResult = {
  data: {
    changedWarnings: [],
    holding: {
      allocationAfter: 0.2308,
      allocationBefore: 0.3333,
      valueAfter: { amount: 18000, currency: 'USD' },
      valueBefore: { amount: 30000, currency: 'USD' }
    },
    newWarnings: [],
    portfolio: {
      change: { amount: -12000, currency: 'USD' },
      changePercentage: -0.12,
      valueAfter: { amount: 88000, currency: 'USD' },
      valueBefore: { amount: 100000, currency: 'USD' }
    },
    resolvedWarnings: [],
    scenario: {
      dataSource: 'YAHOO',
      dropPercentage: 0.4,
      name: 'Apple Inc.',
      symbol: 'AAPL'
    },
    score: { after: 70, before: 72, change: -2 }
  },
  error: null,
  meta: {}
};

describe('WhatIfSimulatorPage', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeAll(() => {
    (
      globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
  });

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  async function render(request: jest.Mock) {
    await act(async () => {
      root.render(
        <WhatIfSimulatorPage
          request={request as unknown as AuthenticatedFetch}
        />
      );
    });
  }

  // React patches the native value setter to track the "last known" value so
  // its synthetic change handler can tell a real edit from a no-op; setting
  // `.value` directly goes through that same patched setter, which makes the
  // tracker think nothing changed and the handler never fires. Going through
  // the underlying native setter first (same trick React Testing Library's
  // fireEvent uses) avoids that.
  function setNativeValue(
    element: HTMLInputElement | HTMLSelectElement,
    value: string
  ) {
    const prototype =
      element instanceof HTMLSelectElement
        ? HTMLSelectElement.prototype
        : HTMLInputElement.prototype;
    const nativeSetter = Object.getOwnPropertyDescriptor(
      prototype,
      'value'
    )?.set;

    nativeSetter?.call(element, value);
  }

  function selectHolding(value: string) {
    act(() => {
      const select = container.querySelector('select') as HTMLSelectElement;

      setNativeValue(select, value);
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });
  }

  function setDropPercentage(value: string) {
    act(() => {
      const input = container.querySelector(
        'input[type="number"]'
      ) as HTMLInputElement;

      setNativeValue(input, value);
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
  }

  function submit() {
    const button = Array.from(container.querySelectorAll('button')).find(
      (candidate) => candidate.textContent?.includes('Run simulation')
    );

    button?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  }

  it('loads holdings through the host fetch and shows a distinct loading state until they arrive', async () => {
    let resolveHoldings: (() => void) | undefined;
    const request = jest.fn((url: string) => {
      if (url === HOLDINGS_URL) {
        return new Promise((resolve) => {
          resolveHoldings = () => resolve(respond(200, oneHolding));
        });
      }

      throw new Error(`unexpected request to ${url}`);
    });

    await render(request);

    expect(container.textContent).toContain('Loading holdings…');
    expect(container.textContent).not.toContain('No holdings available');

    await act(async () => {
      resolveHoldings?.();
      await Promise.resolve();
    });

    expect(container.textContent).toContain('Apple Inc. (AAPL · YAHOO)');
  });

  it('shows a genuinely empty portfolio distinctly once holdings have loaded with none', async () => {
    const request = jest.fn((url: string) => {
      if (url === HOLDINGS_URL) {
        return respond(200, { holdings: [] });
      }

      throw new Error(`unexpected request to ${url}`);
    });

    await render(request);
    await act(async () => Promise.resolve());

    expect(container.textContent).toContain('No holdings available');
  });

  it('shows a retryable error, not the empty-portfolio placeholder, when the holdings request fails', async () => {
    let fail = true;
    const request = jest.fn((url: string) => {
      if (url === HOLDINGS_URL) {
        return fail
          ? respond(500, { message: 'server error' })
          : respond(200, oneHolding);
      }

      throw new Error(`unexpected request to ${url}`);
    });

    await render(request);
    await act(async () => Promise.resolve());

    expect(container.textContent).toContain('Could not load holdings');
    expect(container.textContent).not.toContain('No holdings available');

    fail = false;

    const retry = Array.from(container.querySelectorAll('button')).find(
      (candidate) => candidate.textContent?.includes('Retry')
    );

    await act(async () => {
      retry?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
    });

    expect(container.textContent).toContain('Apple Inc. (AAPL · YAHOO)');
  });

  it('does not call the API and shows inline errors for invalid input', async () => {
    const request = jest.fn((url: string) => {
      if (url === HOLDINGS_URL) {
        return respond(200, oneHolding);
      }

      throw new Error(`unexpected request to ${url}`);
    });

    await render(request);
    await act(async () => Promise.resolve());

    await act(async () => submit());

    expect(request).toHaveBeenCalledTimes(1);
    expect(container.textContent).toContain('Choose a holding to shock.');
    expect(container.textContent).toContain('Enter a drop percentage.');
  });

  it('submits the selected holding and shows the result on success', async () => {
    const request = jest.fn((url: string) => {
      if (url === HOLDINGS_URL) {
        return respond(200, oneHolding);
      }

      if (url === '/api/v1/risk/what-if') {
        return respond(200, whatIfResult);
      }

      throw new Error(`unexpected request to ${url}`);
    });

    await render(request);
    await act(async () => Promise.resolve());

    selectHolding('YAHOO:AAPL');
    setDropPercentage('40');

    await act(async () => {
      submit();
      await Promise.resolve();
    });

    expect(request).toHaveBeenCalledWith(
      '/api/v1/risk/what-if',
      expect.objectContaining({
        body: JSON.stringify({
          dataSource: 'YAHOO',
          dropPercentage: 0.4,
          symbol: 'AAPL'
        }),
        method: 'POST'
      })
    );
    expect(container.textContent).toContain('Scenario: Apple Inc.');
  });

  it('shows a retryable error and succeeds on retry', async () => {
    const request = jest.fn().mockImplementation((url: string) => {
      if (url === HOLDINGS_URL) {
        return respond(200, oneHolding);
      }

      throw new Error(`unexpected request to ${url}`);
    });

    await render(request);
    await act(async () => Promise.resolve());

    request.mockImplementation((url: string) => {
      if (url === '/api/v1/risk/what-if') {
        return respond(404, {
          data: null,
          error: {
            code: 'RISK_WHATIF_HOLDING_NOT_FOUND',
            message: 'No open holding found for YAHOO:AAPL'
          },
          meta: {}
        });
      }

      throw new Error(`unexpected request to ${url}`);
    });

    selectHolding('YAHOO:AAPL');
    setDropPercentage('40');

    await act(async () => {
      submit();
      await Promise.resolve();
    });

    expect(container.textContent).toContain(
      'No open holding found for YAHOO:AAPL'
    );

    request.mockImplementation((url: string) => {
      if (url === '/api/v1/risk/what-if') {
        return respond(200, whatIfResult);
      }

      throw new Error(`unexpected request to ${url}`);
    });

    const retry = Array.from(container.querySelectorAll('button')).find(
      (candidate) => candidate.textContent?.includes('Try again')
    );

    await act(async () => {
      retry?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
    });

    expect(container.textContent).toContain('Scenario: Apple Inc.');
  });
});
