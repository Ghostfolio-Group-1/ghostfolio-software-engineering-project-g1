/** @jest-environment jsdom */
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';

import type { AuthenticatedFetch } from '../data/api-request';
import { RiskThresholdsPage } from './risk-thresholds-page';

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

const defaultItem = {
  defaults: { max: 0.1, redMax: 0.25 },
  isActive: true,
  isCustomized: false,
  name: 'Single stock concentration',
  ruleKey: 'SingleStockConcentration',
  shape: 'ceiling',
  thresholds: { max: 0.1, redMax: 0.25 }
};

const customizedItem = {
  ...defaultItem,
  isCustomized: true,
  thresholds: { max: 0.2, redMax: 0.25 }
};

describe('RiskThresholdsPage', () => {
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
      root.render(<RiskThresholdsPage request={request} />);
    });
  }

  it('fetches /risk/thresholds and renders each rule', async () => {
    const request = jest
      .fn()
      .mockResolvedValue(httpResponse(okEnvelope([defaultItem])));

    await render(request as unknown as AuthenticatedFetch);

    expect(request).toHaveBeenCalledWith(
      '/api/v1/risk/thresholds',
      expect.objectContaining({ method: 'GET' })
    );
    expect(container.textContent).toContain('Single stock concentration');
  });

  it('PUTs the edited thresholds for the row that was saved', async () => {
    let current = [defaultItem];
    const request = jest
      .fn()
      .mockImplementation((_url: string, init?: RequestInit) => {
        if (init?.method === 'PUT') {
          current = [customizedItem];

          return Promise.resolve(httpResponse(okEnvelope(customizedItem)));
        }

        return Promise.resolve(httpResponse(okEnvelope(current)));
      });

    await render(request as unknown as AuthenticatedFetch);

    const maxInput = container.querySelector(
      '[aria-label="SingleStockConcentration-max"]'
    ) as HTMLInputElement;
    const nativeSetter = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      'value'
    )?.set;

    await act(async () => {
      nativeSetter?.call(maxInput, '20');
      maxInput.dispatchEvent(new Event('input', { bubbles: true }));
    });

    const saveButton = Array.from(container.querySelectorAll('button')).find(
      (button) => button.textContent === 'Save'
    );

    await act(async () => {
      saveButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(request).toHaveBeenCalledWith(
      '/api/v1/risk/thresholds/SingleStockConcentration',
      expect.objectContaining({
        body: JSON.stringify({
          isActive: true,
          thresholds: { max: 0.2, redMax: 0.25 }
        }),
        method: 'PUT'
      })
    );
    expect(container.textContent).toContain('Customized');
  });

  it('DELETEs on reset and shows the default thresholds again', async () => {
    let current = [customizedItem];
    const request = jest
      .fn()
      .mockImplementation((_url: string, init?: RequestInit) => {
        if (init?.method === 'DELETE') {
          current = [defaultItem];

          return Promise.resolve(httpResponse(okEnvelope(defaultItem)));
        }

        return Promise.resolve(httpResponse(okEnvelope(current)));
      });

    await render(request as unknown as AuthenticatedFetch);

    const resetButton = Array.from(container.querySelectorAll('button')).find(
      (button) => button.textContent === 'Reset to default'
    );

    await act(async () => {
      resetButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(request).toHaveBeenCalledWith(
      '/api/v1/risk/thresholds/SingleStockConcentration',
      expect.objectContaining({ method: 'DELETE' })
    );
    expect(container.textContent).not.toContain('Customized');
  });

  it('shows a row-level error without clearing the other rows', async () => {
    const request = jest
      .fn()
      .mockImplementation((_url: string, init?: RequestInit) => {
        if (init?.method === 'PUT') {
          return Promise.resolve(
            httpResponse(
              {
                data: null,
                error: {
                  code: 'RISK_THRESHOLD_INVALID_ORDER',
                  message: 'max (0.9) must be less than redMax (0.25).'
                },
                meta: {}
              },
              400
            )
          );
        }

        return Promise.resolve(httpResponse(okEnvelope([defaultItem])));
      });

    await render(request as unknown as AuthenticatedFetch);

    const maxInput = container.querySelector(
      '[aria-label="SingleStockConcentration-max"]'
    ) as HTMLInputElement;
    const nativeSetter = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      'value'
    )?.set;

    await act(async () => {
      nativeSetter?.call(maxInput, '20');
      maxInput.dispatchEvent(new Event('input', { bubbles: true }));
    });

    const saveButton = Array.from(container.querySelectorAll('button')).find(
      (button) => button.textContent === 'Save'
    );

    await act(async () => {
      saveButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(container.textContent).toContain(
      'max (0.9) must be less than redMax (0.25).'
    );
  });
});
