/** @jest-environment jsdom */
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { act } from 'react-dom/test-utils';

import { TaxLotsScreen, TaxLotsTable } from './tax-lots-table';
import { TaxLotsApiError } from './use-tax-lots';
import type { TaxLotsData, TaxLotsFetch, TaxLotsState } from './use-tax-lots';

const lot: TaxLotsData['lots'][number] = {
  accountId: 'account-1',
  acquiredAt: '2026-01-05T00:00:00.000Z',
  consumedQuantity: '0.000000000000000001',
  currency: 'USD',
  lotId: 'lot-1',
  originalQuantity: '10.123456789012345678',
  relatedSellActivityIds: ['sell-42'],
  remainingQuantity: '10.123456789012345677',
  sourceActivityId: 'buy-14',
  status: 'PARTIALLY_CONSUMED',
  symbolProfileId: 'asset-8'
};

const ready: TaxLotsState = {
  data: { lots: [lot] },
  diagnostics: [],
  error: null,
  isComplete: true,
  status: 'ready'
};

function view(state: TaxLotsState): string {
  return renderToStaticMarkup(<TaxLotsTable {...state} />);
}

describe('TaxLotsTable', () => {
  it('renders FIFO lot quantities and source IDs without numeric conversion', () => {
    const html = view(ready);

    expect(html).toContain('FIFO acquisition lots');
    expect(html).toContain('2026-01-05');
    expect(html).toContain('10.123456789012345678');
    expect(html).toContain('0.000000000000000001');
    expect(html).toContain('10.123456789012345677');
    expect(html).toContain('PARTIALLY_CONSUMED');
    expect(html).toContain('lot-1');
    expect(html).toContain('asset-8');
    expect(html).toContain('buy-14');
    expect(html).toContain('sell-42');
    expect(html).toContain('account-1');
    expect(html).toContain('text-align:right');
  });

  it('shows a loading state before the hook data arrives', () => {
    const html = view({
      data: null,
      diagnostics: [],
      error: null,
      isComplete: null,
      status: 'loading'
    });

    expect(html).toContain('aria-busy="true"');
    expect(html).not.toContain('lot-1');
  });

  it('shows a normal empty state when there are no complete FIFO lots', () => {
    const html = view({ ...ready, data: { lots: [] }, status: 'empty' });

    expect(html).toContain('No FIFO tax lots available');
    expect(html).not.toContain('FIFO acquisition lots');
  });

  it('shows a warning instead of a normal empty state for incomplete history', () => {
    const html = view({
      ...ready,
      data: { isComplete: false, lots: [] },
      diagnostics: [
        {
          affectedSellActivityIds: ['sell-42'],
          code: 'TAX_SCOPE_HAS_EXCLUDED_INVESTMENT_HISTORY',
          excludedActivityIds: ['buy-14'],
          message: 'History excluded'
        }
      ],
      isComplete: false,
      status: 'ready'
    });

    expect(html).toContain('role="alert"');
    expect(html).toContain('may be incomplete');
    expect(html).toContain('1 diagnostic');
    expect(html).toContain('No FIFO lots in the returned data');
    expect(html).not.toContain('No FIFO tax lots available');
  });

  it('shows safe errors and a retry control', () => {
    const html = renderToStaticMarkup(
      <TaxLotsTable
        {...ready}
        data={null}
        error={new TaxLotsApiError(401, 'TAX_AUTH', 'server detail')}
        isComplete={null}
        onRetry={jest.fn()}
        status="error"
      />
    );

    expect(html).toContain('Please sign in to view tax lots');
    expect(html).toContain('Try again');
    expect(html).not.toContain('server detail');
  });
});

describe('TaxLotsScreen', () => {
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

  it('uses the authenticated hook to show the backend lots', async () => {
    const mock = jest.fn().mockResolvedValue({
      json: jest.fn().mockResolvedValue({
        data: { lots: [lot] },
        error: null,
        meta: {}
      }),
      ok: true,
      status: 200
    });
    const request = mock as unknown as TaxLotsFetch;

    await act(async () => {
      root.render(<TaxLotsScreen request={request} />);
    });

    expect(mock).toHaveBeenCalledTimes(1);
    expect(mock).toHaveBeenCalledWith(
      '/api/v1/tax/lots',
      expect.objectContaining({ method: 'GET' })
    );
    expect(container.textContent).toContain('10.123456789012345677');
  });

  it('switches to average-cost information without mislabeling FIFO lots', async () => {
    const mock = jest.fn().mockResolvedValue({
      json: jest.fn().mockResolvedValue({
        data: { lots: [lot] },
        error: null,
        meta: {}
      }),
      ok: true,
      status: 200
    });

    await act(async () => {
      root.render(<TaxLotsScreen request={mock as unknown as TaxLotsFetch} />);
    });

    const selector = container.querySelector('select') as HTMLSelectElement;
    expect(selector.value).toBe('FIFO');

    await act(async () => {
      selector.value = 'AVERAGE_COST';
      selector.dispatchEvent(new Event('change', { bubbles: true }));
    });

    expect(selector.value).toBe('AVERAGE_COST');
    expect(container.textContent).toContain('pooled cost basis');
    expect(container.textContent).not.toContain('10.123456789012345677');
    expect(mock).toHaveBeenCalledTimes(1);
  });
});
