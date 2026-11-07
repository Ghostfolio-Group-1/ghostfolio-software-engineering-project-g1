/** @jest-environment jsdom */
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';

import { ThemeProvider } from '../theme/theme-provider';
import { ChartWrapper } from './chart-wrapper';

const points = [
  { date: '2026-01-01', value: 10 },
  { date: '2026-01-02', value: 20 },
  { date: '2026-01-03', value: 15 }
];

describe('ChartWrapper value series', () => {
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

  it('moves the readout along the value series', () => {
    act(() => {
      root.render(
        <ThemeProvider>
          <ChartWrapper
            height={100}
            points={points}
            title="Portfolio value"
            width={300}
          />
        </ThemeProvider>
      );
    });

    const svg = container.querySelector('svg') as SVGSVGElement;

    svg.getBoundingClientRect = () =>
      ({
        left: 0,
        width: 300
      }) as DOMRect;

    const PointerEventPolyfill =
      typeof PointerEvent === 'undefined'
        ? (class extends MouseEvent {
            public constructor(type: string, init: MouseEventInit = {}) {
              super(type, init);
            }
          } as unknown as typeof PointerEvent)
        : PointerEvent;

    act(() => {
      svg.dispatchEvent(
        new PointerEventPolyfill('pointermove', { bubbles: true, clientX: 0 })
      );
    });

    const readout = container.querySelector(
      '[data-testid="chart-value-readout"]'
    );

    expect(readout?.getAttribute('aria-live')).toBe('polite');
    expect(readout?.textContent).toBe('2026-01-01: 10.00');
    expect(svg.getAttribute('role')).toBe('group');
    expect(svg.getAttribute('aria-describedby')).toBe(readout?.id);

    act(() => {
      svg.dispatchEvent(
        new KeyboardEvent('keydown', { bubbles: true, key: 'ArrowRight' })
      );
    });

    expect(
      container.querySelector('[data-testid="chart-value-readout"]')
        ?.textContent
    ).toBe('2026-01-02: 20.00');
  });
});
