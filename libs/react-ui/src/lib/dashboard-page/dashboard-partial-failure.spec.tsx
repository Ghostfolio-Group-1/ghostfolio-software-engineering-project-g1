/** @jest-environment jsdom */
import { createRoot } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { act } from 'react-dom/test-utils';

import {
  DashboardPartialFailure,
  failedSections,
  isPartialFailure
} from './dashboard-partial-failure';

describe('failedSections', () => {
  it('lists the sections in the error state in page order', () => {
    expect(
      failedSections({
        charts: { status: 'error' },
        risk: { status: 'ready' },
        tax: { status: 'error' }
      })
    ).toEqual(['tax', 'charts']);
  });

  it('ignores loading, empty and missing sections', () => {
    expect(
      failedSections({
        charts: { status: 'empty' },
        risk: { status: 'loading' }
      })
    ).toEqual([]);
  });
});

describe('isPartialFailure', () => {
  it('is true only when some but not all sections failed', () => {
    expect(isPartialFailure([])).toBe(false);
    expect(isPartialFailure(['risk'])).toBe(true);
    expect(isPartialFailure(['risk', 'tax'])).toBe(true);
    expect(isPartialFailure(['risk', 'tax', 'charts'])).toBe(false);
  });
});

describe('DashboardPartialFailure', () => {
  beforeAll(() => {
    (
      globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
  });

  it('names the failed sections by their card titles', () => {
    const html = renderToStaticMarkup(
      <DashboardPartialFailure failed={['risk', 'charts']} />
    );

    expect(html).toContain('role="status"');
    expect(html).toContain('Portfolio risk, Performance could not be loaded.');
    expect(html).toContain('The other sections are shown below.');
  });

  it('renders nothing when nothing or everything failed', () => {
    expect(renderToStaticMarkup(<DashboardPartialFailure failed={[]} />)).toBe(
      ''
    );
    expect(
      renderToStaticMarkup(
        <DashboardPartialFailure failed={['risk', 'tax', 'charts']} />
      )
    ).toBe('');
  });

  it('retries when the button is pressed', () => {
    const onRetry = jest.fn();
    const container = document.createElement('div');
    const root = createRoot(container);

    act(() => {
      root.render(
        <DashboardPartialFailure failed={['tax']} onRetry={onRetry} />
      );
    });

    act(() => {
      container
        .querySelector('button')
        ?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(onRetry).toHaveBeenCalledTimes(1);
    act(() => root.unmount());
  });
});
