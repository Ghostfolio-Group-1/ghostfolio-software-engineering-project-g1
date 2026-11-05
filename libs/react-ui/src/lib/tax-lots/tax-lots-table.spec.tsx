/** @jest-environment jsdom */
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { act } from 'react-dom/test-utils';

import { TaxLotsScreen, TaxLotsTable } from './tax-lots-table';
import { TaxLotsApiError } from './use-tax-lots';
import type {
  TaxLot,
  TaxLotsData,
  TaxLotsFetch,
  TaxLotsState
} from './use-tax-lots';

const lot: TaxLot = {
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

const incompleteDiagnostic = {
  affectedSellActivityIds: ['sell-42'],
  code: 'TAX_SCOPE_HAS_EXCLUDED_INVESTMENT_HISTORY' as const,
  excludedActivityIds: ['buy-14'],
  message: 'Excluded investment history may affect the result.'
};

function view(state: TaxLotsState): string {
  return renderToStaticMarkup(<TaxLotsTable {...state} />);
}

function mockResponse(data: TaxLotsData) {
  return {
    json: jest.fn().mockResolvedValue({ data, error: null, meta: {} }),
    ok: true,
    status: 200
  } as unknown as Response;
}

describe('TaxLotsTable', () => {
  it('renders FIFO quantities and source IDs without numeric conversion', () => {
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
    expect(html).toContain('Original quantity');
    expect(html).toContain('Remaining quantity');
  });

  it('shows loading without showing tax data', () => {
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

  it('shows an empty state only when the returned history is complete', () => {
    const html = view({ ...ready, data: { lots: [] }, status: 'empty' });
    expect(html).toContain('No FIFO tax lots available');
    expect(html).not.toContain('FIFO acquisition lots');
  });

  it('shows diagnostic details when incomplete history has no lots', () => {
    const html = view({
      ...ready,
      data: { isComplete: false, lots: [] },
      diagnostics: [incompleteDiagnostic],
      isComplete: false,
      status: 'ready'
    });

    expect(html).toContain('role="alert"');
    expect(html).toContain('may be incomplete');
    expect(html).toContain('<details');
    expect(html).toContain('View exclusion details');
    expect(html).toContain(incompleteDiagnostic.message);
    expect(html).toContain('Affected SELL activity IDs:');
    expect(html).toContain('sell-42');
    expect(html).toContain('Excluded activity IDs:');
    expect(html).toContain('buy-14');
    expect(html).toContain('No open or partially consumed FIFO lots');
    expect(html).not.toContain('No FIFO tax lots available');
  });

  it('shows an incomplete-history warning and the returned lots together', () => {
    const html = view({
      ...ready,
      data: { isComplete: false, lots: [lot] },
      diagnostics: [incompleteDiagnostic],
      isComplete: false
    });

    expect(html).toContain('role="alert"');
    expect(html).toContain(incompleteDiagnostic.message);
    expect(html).toContain('10.123456789012345677');
  });

  it('shows a warning even when incomplete history has no diagnostic details', () => {
    const html = view({
      ...ready,
      data: { isComplete: false, lots: [] },
      diagnostics: [],
      isComplete: false
    });

    expect(html).toContain('No exclusion details were provided');
  });

  it('provides safe, different messages for 401, 403, 422, and 5xx', () => {
    const cases = [
      [401, 'Please sign in again'],
      [403, 'do not have permission'],
      [422, 'could not be processed'],
      [503, 'temporarily unavailable']
    ] as const;

    for (const [status, expectedMessage] of cases) {
      const html = view({
        ...ready,
        data: null,
        error: new TaxLotsApiError(status, 'TAX_FAILED', 'server detail'),
        isComplete: null,
        status: 'error'
      });
      expect(html).toContain(expectedMessage);
      expect(html).not.toContain('server detail');
    }
  });

  it('does not offer retry for a 401 or 403 login/permission error', () => {
    for (const status of [401, 403]) {
      const html = renderToStaticMarkup(
        <TaxLotsTable
          {...ready}
          data={null}
          error={new TaxLotsApiError(status, 'TAX_AUTH', 'server detail')}
          isComplete={null}
          onRetry={jest.fn()}
          status="error"
        />
      );
      expect(html).not.toContain('Try again');
    }
  });

  it('renders an Unassigned account and em dash for empty SELL IDs', () => {
    const html = view({
      ...ready,
      data: {
        lots: [{ ...lot, accountId: null, relatedSellActivityIds: [] }]
      }
    });

    expect(html).toContain('Unassigned');
    expect(html).toContain('Related SELL IDs');
    expect(html).toContain('>—<');
  });

  it('keeps the method selector labelled and disables average cost', () => {
    const html = view(ready);
    expect(html).toContain('Cost-basis method');
    expect(html).toMatch(/<option[^>]*disabled[^>]*value="AVERAGE_COST"/);
    expect(html).toContain('not available for tax lots');
    expect(html).not.toContain('Week 2');
  });

  it('defaults to open lots and can show closed lots when the filter is changed', () => {
    const closed: TaxLot = {
      ...lot,
      lotId: 'closed-1',
      remainingQuantity: '0',
      status: 'CLOSED'
    };
    const state = { ...ready, data: { lots: [closed, lot] } };

    expect(view(state)).not.toContain('closed-1');
    expect(
      renderToStaticMarkup(<TaxLotsTable {...state} statusFilter="ALL" />)
    ).toContain('closed-1');
  });

  it('explains how to view closed lots when the default filter finds none', () => {
    const closed: TaxLot = {
      ...lot,
      lotId: 'closed-only',
      remainingQuantity: '0',
      status: 'CLOSED'
    };
    const state = { ...ready, data: { lots: [closed] } };
    const html = view(state);

    expect(html).toContain('Open and partially consumed');
    expect(html).toContain('No open or partially consumed FIFO lots');
    expect(html).toContain('Use the All lots filter to view closed lots');
    expect(html).not.toContain('No FIFO tax lots available');
    expect(html).not.toContain('>closed-only<');
    expect(
      renderToStaticMarkup(<TaxLotsTable {...state} statusFilter="ALL" />)
    ).toContain('>closed-only<');
  });

  it('sorts lots by acquisition date and then lot ID', () => {
    const earlier = {
      ...lot,
      acquiredAt: '2025-12-01T00:00:00.000Z',
      lotId: 'early'
    };
    const later = { ...lot, lotId: 'late' };
    const html = view({ ...ready, data: { lots: [later, earlier] } });
    expect(html).toContain('>early<');
    expect(html).toContain('>late<');
    expect(html.indexOf('>early<')).toBeLessThan(html.indexOf('>late<'));

    const sameDateA = { ...lot, lotId: 'same-a' };
    const sameDateZ = { ...lot, lotId: 'same-z' };
    const tiedHtml = view({
      ...ready,
      data: { lots: [sameDateZ, sameDateA] }
    });
    expect(tiedHtml).toContain('>same-a<');
    expect(tiedHtml).toContain('>same-z<');
    expect(tiedHtml.indexOf('>same-a<')).toBeLessThan(
      tiedHtml.indexOf('>same-z<')
    );

    // Code-point order is stable even where localeCompare would sort differently.
    const codePointHtml = view({
      ...ready,
      data: {
        lots: [
          { ...lot, lotId: 'a' },
          { ...lot, lotId: 'B' }
        ]
      }
    });
    expect(codePointHtml.indexOf('>B<')).toBeLessThan(
      codePointHtml.indexOf('>a<')
    );
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

  it('fetches the Tax API via the supplied host adapter and displays lots', async () => {
    const mock = jest.fn().mockResolvedValue(mockResponse({ lots: [lot] }));
    await act(async () => {
      root.render(<TaxLotsScreen request={mock as TaxLotsFetch} />);
    });

    expect(mock).toHaveBeenCalledTimes(1);
    expect(mock).toHaveBeenCalledWith(
      '/api/v1/tax/lots',
      expect.objectContaining({ method: 'GET' })
    );
    expect(container.textContent).toContain('10.123456789012345677');
  });

  it('does not refetch if the host supplies a new callback identity', async () => {
    const mock = jest.fn().mockResolvedValue(mockResponse({ lots: [lot] }));
    const first = ((input: RequestInfo | URL, init?: RequestInit) =>
      mock(input, init)) as TaxLotsFetch;
    const second = ((input: RequestInfo | URL, init?: RequestInit) =>
      mock(input, init)) as TaxLotsFetch;

    await act(async () => {
      root.render(<TaxLotsScreen request={first} />);
    });
    await act(async () => {
      root.render(<TaxLotsScreen request={second} />);
    });

    expect(mock).toHaveBeenCalledTimes(1);
  });

  it('keeps average cost disabled and supports switching the lot-status filter', async () => {
    const closed: TaxLot = {
      ...lot,
      lotId: 'closed-1',
      remainingQuantity: '0',
      status: 'CLOSED'
    };
    const mock = jest
      .fn()
      .mockResolvedValue(mockResponse({ lots: [lot, closed] }));

    await act(async () => {
      root.render(<TaxLotsScreen request={mock as TaxLotsFetch} />);
    });

    const method = container.querySelectorAll('select')[0];
    const filter = container.querySelectorAll('select')[1];
    const average = method.querySelector('option[value="AVERAGE_COST"]');
    expect(average?.hasAttribute('disabled')).toBe(true);
    expect(container.textContent).not.toContain('closed-1');

    await act(async () => {
      filter.value = 'ALL';
      filter.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(container.textContent).toContain('closed-1');

    await act(async () => {
      filter.value = 'OPEN';
      filter.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(container.textContent).not.toContain('closed-1');
    expect(mock).toHaveBeenCalledTimes(1);
  });

  it('invokes the retry callback when a transient server error is displayed', async () => {
    const onRetry = jest.fn();
    const errorState: TaxLotsState = {
      data: null,
      diagnostics: [],
      error: new TaxLotsApiError(503, 'TAX_DOWN', 'internal details'),
      isComplete: null,
      status: 'error'
    };

    await act(async () => {
      root.render(<TaxLotsTable {...errorState} onRetry={onRetry} />);
    });
    const retry = Array.from(container.querySelectorAll('button')).find(
      (button) => button.textContent?.includes('Try again')
    );
    expect(retry).toBeDefined();
    await act(async () => {
      retry?.click();
    });
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
