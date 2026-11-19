import type { ReactElement } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';

import { ChartSeriesCard } from '../src/lib/chart-series/chart-series-card';
import { fetchChartSeries } from '../src/lib/chart-series/use-chart-series';
import type {
  ChartSeriesData,
  ChartSeriesKind
} from '../src/lib/chart-series/use-chart-series';
import { toPath } from '../src/lib/chart-wrapper/chart-wrapper';
import { DrawdownCard } from '../src/lib/charts-drawdown/drawdown-card';
import {
  fetchDrawdown,
  formatDrawdownPercent
} from '../src/lib/charts-drawdown/drawdown.client';
import { createIntegrationSession, INTEGRATION_API_URL } from './api-session';
import type { IntegrationSession } from './api-session';

// This suite requires the running demo API and the shared per-run portfolio.
// Without INTEGRATION_API_URL it is skipped; a skipped run is not live evidence.
// Benchmark comparison and total-versus-price return are not on main (their
// screens and routes are still on cursor/charts-benchmark-and-return-comparison),
// so this file stops at the series kind toggle and drawdown.
const describeLive = INTEGRATION_API_URL ? describe : describe.skip;

// Fixed window inside the fixture's prices. Daily, because it is under two years.
// Opening: 10 ALPHA @ 100 and 5 BETA @ 50. The 2025-06-02 sale leaves 6 ALPHA,
// still priced at 120, with BETA carried at 50. From 2026-11-09 the marks are
// 130 and 55. Invested capital is remaining cost (quantity × buy price) and
// steps down on the sale. The fixture has no cash holding.
const RANGE = { endDate: '2026-11-09', startDate: '2025-01-06' };
const SALE_DATE = '2025-06-02';
const LATEST_PRICE_DATE = '2026-11-09';
const CHART_WIDTH = 480;
const CHART_HEIGHT = 160;

const KINDS = ['portfolioValue', 'investedCapital', 'cash'] as const;

function marketValue(date: string): number {
  if (date < SALE_DATE) {
    return 10 * 100 + 5 * 50;
  }

  if (date < LATEST_PRICE_DATE) {
    return 6 * 120 + 5 * 50;
  }

  return 6 * 130 + 5 * 55;
}

function investedCapital(date: string): number {
  if (date < SALE_DATE) {
    return 10 * 100 + 5 * 50;
  }

  return 6 * 100 + 5 * 50;
}

describeLive(
  'Chart series, kind toggles, and drawdown against the real API',
  () => {
    let container: HTMLDivElement;
    let root: Root;
    let session: IntegrationSession;

    beforeAll(async () => {
      (
        globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
      ).IS_REACT_ACT_ENVIRONMENT = true;

      session = await createIntegrationSession(INTEGRATION_API_URL as string);
    });

    beforeEach(() => {
      container = document.createElement('div');
      document.body.appendChild(container);
      root = createRoot(container);
    });

    afterEach(() => {
      if (root) {
        act(() => root.unmount());
      }

      container?.remove();
    });

    async function render(element: ReactElement) {
      await act(async () => {
        root.render(element);
      });
    }

    async function settled() {
      for (let attempt = 0; attempt < 100; attempt++) {
        if (!container.querySelector('[aria-busy="true"]')) {
          break;
        }

        await act(async () => {
          await new Promise((resolve) => setTimeout(resolve, 100));
        });
      }

      expect(container.querySelector('[aria-busy="true"]')).toBeNull();
    }

    async function selectKind(kind: ChartSeriesKind) {
      const button = container.querySelector(`[data-kind="${kind}"]`);

      expect(button).toBeInstanceOf(HTMLButtonElement);

      await act(async () => {
        (button as HTMLButtonElement).click();
      });

      await settled();
    }

    function chartPath(): string | null {
      return container.querySelector('svg path')?.getAttribute('d') ?? null;
    }

    it('prices the fixture on one date index for value, invested capital, and cash', async () => {
      const series = await Promise.all(
        KINDS.map((kind) => {
          return fetchChartSeries({ ...RANGE, kind }, session.request);
        })
      );
      const [value, invested, cash] = series;

      for (const data of series) {
        expect(data.granularity).toBe('daily');
        expect(data.startDate).toBe(RANGE.startDate);
        expect(data.endDate).toBe(RANGE.endDate);
        expect(data.points.length).toBeGreaterThan(1);
        expect(data.points.map(({ date }) => date)).toEqual(
          value.points.map(({ date }) => date)
        );
      }

      expect(value.kind).toBe('portfolioValue');
      expect(invested.kind).toBe('investedCapital');
      expect(cash.kind).toBe('cash');
      expect(value.points.map(({ date }) => date)).toEqual(
        expect.arrayContaining(['2025-01-06', SALE_DATE, '2025-07-01'])
      );

      expect(value.points).toEqual(
        value.points.map(({ date }) => {
          return { date, value: marketValue(date) };
        })
      );
      expect(invested.points).toEqual(
        invested.points.map(({ date }) => {
          return { date, value: investedCapital(date) };
        })
      );
      expect(cash.points.every(({ value: amount }) => amount === 0)).toBe(true);
    });

    it('replots the chart from the live series when the kind toggle changes', async () => {
      const byKind = new Map<ChartSeriesKind, ChartSeriesData>(
        await Promise.all(
          KINDS.map(async (kind) => {
            return [
              kind,
              await fetchChartSeries({ ...RANGE, kind }, session.request)
            ] as const;
          })
        )
      );

      await render(<ChartSeriesCard range={RANGE} request={session.request} />);
      await settled();

      expect(
        container.querySelector('[data-testid="chart-series-kind-label"]')
          ?.textContent
      ).toBe('Showing Portfolio value');
      expect(
        container
          .querySelector('[data-kind="portfolioValue"]')
          ?.getAttribute('aria-pressed')
      ).toBe('true');
      expect(chartPath()).toBe(
        toPath(
          byKind.get('portfolioValue')?.points ?? [],
          CHART_WIDTH,
          CHART_HEIGHT
        )
      );

      await selectKind('investedCapital');

      expect(
        container.querySelector('[data-testid="chart-series-kind-label"]')
          ?.textContent
      ).toBe('Showing Invested capital');
      expect(
        container
          .querySelector('[data-kind="investedCapital"]')
          ?.getAttribute('aria-pressed')
      ).toBe('true');
      expect(
        container
          .querySelector('[data-kind="portfolioValue"]')
          ?.getAttribute('aria-pressed')
      ).toBe('false');
      expect(chartPath()).toBe(
        toPath(
          byKind.get('investedCapital')?.points ?? [],
          CHART_WIDTH,
          CHART_HEIGHT
        )
      );
      expect(chartPath()).not.toBe(
        toPath(
          byKind.get('portfolioValue')?.points ?? [],
          CHART_WIDTH,
          CHART_HEIGHT
        )
      );

      await selectKind('cash');

      expect(
        container.querySelector('[data-testid="chart-series-kind-label"]')
          ?.textContent
      ).toBe('Showing Cash');
      expect(chartPath()).toBe(
        toPath(byKind.get('cash')?.points ?? [], CHART_WIDTH, CHART_HEIGHT)
      );

      await selectKind('portfolioValue');

      expect(chartPath()).toBe(
        toPath(
          byKind.get('portfolioValue')?.points ?? [],
          CHART_WIDTH,
          CHART_HEIGHT
        )
      );
      expect(container.querySelector('[role="alert"]')).toBeNull();
    });

    it('plots drawdown from the live route and shows that series max', async () => {
      const data = await fetchDrawdown(RANGE, session.request);
      const lowest = Math.min(...data.points.map(({ drawdown }) => drawdown));

      expect(data.granularity).toBe('daily');
      expect(data.points.length).toBeGreaterThan(1);
      expect(data.points[0]).toMatchObject({
        date: RANGE.startDate,
        drawdown: 0,
        isNewPeak: true
      });
      expect(data.points.every(({ drawdown }) => drawdown <= 0)).toBe(true);
      expect(data.maxDrawdown).toBe(lowest);
      expect(
        data.points.some(
          ({ date, drawdown }) =>
            date === data.maxDrawdownDate && drawdown === data.maxDrawdown
        )
      ).toBe(true);

      await render(<DrawdownCard range={RANGE} request={session.request} />);
      await settled();

      expect(
        container.querySelector('[data-testid="drawdown-max"]')?.textContent
      ).toBe(
        `Max drawdown ${formatDrawdownPercent(data.maxDrawdown)} on ${data.maxDrawdownDate}`
      );
      expect(chartPath()).toBe(
        toPath(
          data.points.map(({ date, drawdown }) => {
            return { date, value: drawdown };
          }),
          CHART_WIDTH,
          CHART_HEIGHT
        )
      );
      expect(
        container.querySelector('[data-testid="drawdown-short-history"]')
      ).toBeNull();
      expect(container.querySelector('[role="alert"]')).toBeNull();
    });
  }
);
