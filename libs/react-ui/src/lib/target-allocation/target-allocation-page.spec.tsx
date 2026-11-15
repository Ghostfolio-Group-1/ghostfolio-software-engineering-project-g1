/** @jest-environment jsdom */
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';

import type { AuthenticatedFetch } from '../data/api-request';
import { TargetAllocationPage } from './target-allocation-page';

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

// React patches the native value setter to track the "last known" value so
// its synthetic change handler can tell a real edit from a no-op; setting
// `.value` directly goes through that same patched setter, which makes the
// tracker think nothing changed and the handler never fires. Going through
// the underlying native setter first (same trick React Testing Library's
// fireEvent uses, and what-if-simulator-page.spec.tsx's own setNativeValue).
function setNativeValue(element: HTMLInputElement, value: string) {
  const nativeSetter = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    'value'
  )?.set;

  nativeSetter?.call(element, value);
}

const unset = { buckets: [], groupBy: null, isSet: false, targets: [] };
const set = {
  buckets: [
    { actual: 0.6, deviation: 0, key: 'EQUITY', severity: 'GREEN', target: 0.6 }
  ],
  groupBy: 'assetClass',
  isSet: true,
  targets: [{ key: 'EQUITY', percentage: 0.6 }]
};

describe('TargetAllocationPage', () => {
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
      root.render(<TargetAllocationPage request={request} />);
    });
  }

  it('fetches /risk/target-allocation and seeds the form from the existing targets', async () => {
    const request = jest.fn().mockResolvedValue(httpResponse(okEnvelope(set)));

    await render(request as unknown as AuthenticatedFetch);

    expect(request).toHaveBeenCalledWith(
      '/api/v1/risk/target-allocation',
      expect.objectContaining({ method: 'GET' })
    );
    expect(container.textContent).toContain('60% actual');
    expect(
      (container.querySelector('[aria-label="Key"]') as HTMLInputElement).value
    ).toBe('EQUITY');
    expect(
      (container.querySelector('[aria-label="Percentage"]') as HTMLInputElement)
        .value
    ).toBe('60');
  });

  it('tells the user nothing is set yet when there is no target allocation', async () => {
    const request = jest
      .fn()
      .mockResolvedValue(httpResponse(okEnvelope(unset)));

    await render(request as unknown as AuthenticatedFetch);

    expect(container.textContent).toContain(
      'No target allocation configured yet.'
    );
  });

  it('PUTs on submit and shows the saved buckets', async () => {
    let current = unset;
    const request = jest
      .fn()
      .mockImplementation((_url: string, init?: RequestInit) => {
        if (init?.method === 'PUT') {
          current = set;
        }

        return Promise.resolve(httpResponse(okEnvelope(current)));
      });

    await render(request as unknown as AuthenticatedFetch);

    const keyInput = container.querySelector(
      '[aria-label="Key"]'
    ) as HTMLInputElement;
    const percentageInput = container.querySelector(
      '[aria-label="Percentage"]'
    ) as HTMLInputElement;

    await act(async () => {
      setNativeValue(keyInput, 'EQUITY');
      keyInput.dispatchEvent(new Event('input', { bubbles: true }));
      setNativeValue(percentageInput, '100');
      percentageInput.dispatchEvent(new Event('input', { bubbles: true }));
    });

    const submit = Array.from(container.querySelectorAll('button')).find(
      (button) => button.textContent === 'Save target allocation'
    );

    await act(async () => {
      submit?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(request).toHaveBeenCalledWith(
      '/api/v1/risk/target-allocation',
      expect.objectContaining({
        body: JSON.stringify({
          groupBy: 'assetClass',
          targets: [{ key: 'EQUITY', percentage: 1 }]
        }),
        method: 'PUT'
      })
    );
    expect(container.textContent).toContain('60% actual');
    expect(container.textContent).toContain('Clear target allocation');
  });

  it('shows the client-side validation error instead of submitting when the form is invalid', async () => {
    const request = jest
      .fn()
      .mockResolvedValue(httpResponse(okEnvelope(unset)));

    await render(request as unknown as AuthenticatedFetch);

    const submit = Array.from(container.querySelectorAll('button')).find(
      (button) => button.textContent === 'Save target allocation'
    );

    await act(async () => {
      submit?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(container.textContent).toContain('Every row needs a key.');
    expect(request).not.toHaveBeenCalledWith(
      '/api/v1/risk/target-allocation',
      expect.objectContaining({ method: 'PUT' })
    );
  });

  it('shows a generic error message and retries on request when the initial GET fails', async () => {
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

      return Promise.resolve(httpResponse(okEnvelope(unset)));
    });

    await render(request as unknown as AuthenticatedFetch);

    expect(container.textContent).toContain(
      'Target allocation is unavailable right now'
    );
    expect(container.textContent).not.toContain('boom');

    shouldFail = false;
    const retry = Array.from(container.querySelectorAll('button')).find(
      (button) => button.textContent === 'Try again'
    );

    await act(async () => {
      retry?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(container.textContent).toContain(
      'No target allocation configured yet.'
    );
  });

  it('shows the server error message below the form when a save is rejected', async () => {
    const request = jest
      .fn()
      .mockImplementation((_url: string, init?: RequestInit) => {
        if (init?.method === 'PUT') {
          return Promise.resolve(
            httpResponse(
              {
                data: null,
                error: {
                  code: 'RISK_FORBIDDEN',
                  message: 'You do not have permission to change risk settings.'
                },
                meta: {}
              },
              403
            )
          );
        }

        return Promise.resolve(httpResponse(okEnvelope(unset)));
      });

    await render(request as unknown as AuthenticatedFetch);

    const keyInput = container.querySelector(
      '[aria-label="Key"]'
    ) as HTMLInputElement;
    const percentageInput = container.querySelector(
      '[aria-label="Percentage"]'
    ) as HTMLInputElement;

    await act(async () => {
      setNativeValue(keyInput, 'EQUITY');
      keyInput.dispatchEvent(new Event('input', { bubbles: true }));
      setNativeValue(percentageInput, '100');
      percentageInput.dispatchEvent(new Event('input', { bubbles: true }));
    });

    const submit = Array.from(container.querySelectorAll('button')).find(
      (button) => button.textContent === 'Save target allocation'
    );

    await act(async () => {
      submit?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(container.textContent).toContain(
      'You do not have permission to change risk settings.'
    );
    // The unset state is still shown - the rejected save must not be treated
    // as if it succeeded.
    expect(container.textContent).toContain(
      'No target allocation configured yet.'
    );
  });

  it('DELETEs on clear and shows the unset state again', async () => {
    let current = set;
    const request = jest
      .fn()
      .mockImplementation((_url: string, init?: RequestInit) => {
        if (init?.method === 'DELETE') {
          current = unset;
        }

        return Promise.resolve(httpResponse(okEnvelope(current)));
      });

    await render(request as unknown as AuthenticatedFetch);

    const clearButton = Array.from(container.querySelectorAll('button')).find(
      (button) => button.textContent === 'Clear target allocation'
    );

    await act(async () => {
      clearButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(request).toHaveBeenCalledWith(
      '/api/v1/risk/target-allocation',
      expect.objectContaining({ method: 'DELETE' })
    );
    expect(container.textContent).toContain(
      'No target allocation configured yet.'
    );
  });
});
