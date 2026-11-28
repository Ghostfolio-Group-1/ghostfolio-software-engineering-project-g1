import type { ReactElement } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';

import { InteractiveChart } from '../src/lib/chart-series/interactive-chart';
import { fetchChartSeries } from '../src/lib/chart-series/use-chart-series';
import { toPath } from '../src/lib/chart-wrapper/chart-wrapper';
import {
  fetchDrawdown,
  formatDrawdownPercent
} from '../src/lib/charts-drawdown/drawdown.client';
import { createIntegrationSession, INTEGRATION_API_URL } from './api-session';
import type { IntegrationSession } from './api-session';

// Live UI-to-API journey (sprint: series -> toggles -> drawdown). Without
// INTEGRATION_API_URL the suite is skipped. Benchmark comparison (#160) and
// return comparison (#105) are not on main — no React screen and no
// GET /charts/benchmark-comparison or /charts/return-comparison — so those
// steps stay BLOCKED here. Drawdown shares the range toggle on
// InteractiveChart (#356).
const describeLive = INTEGRATION_API_URL ? describe : describe.skip;

const CHART_WIDTH = 480;
const CHART_HEIGHT = 160;
const FIRST_BUY_DATE = '2025-01-06';
// Performance history opens on this date: the portfolio calculator starts the
// day before the first activity, and that snapshot is an empty portfolio.
const DAY_BEFORE_FIRST_BUY = '2025-01-05';
const SALE_DATE = '2025-06-02';
const LATEST_PRICE_DATE = '2026-11-09';
// YTD begins the day before the year, so this window includes 2025-12-31.
const YTD_START = '2025-12-31';
const YEAR_START = '2026-01-01';

// 10 ALPHA @ 100 and 5 BETA @ 50, then 6 ALPHA after the sale. BETA stays at
// 50 until the 2026-11-09 marks (130 and 55). Invested capital is remaining
// cost and steps down on the sale. There is no cash holding. Dates before
// the first buy are the empty opening point, so both series are 0 there.
function marketValue(date: string): number {
  if (date < FIRST_BUY_DATE) {
    return 0;
  }

  if (date < SALE_DATE) {
    return 10 * 100 + 5 * 50;
  }

  if (date < LATEST_PRICE_DATE) {
    return 6 * 120 + 5 * 50;
  }

  return 6 * 130 + 5 * 55;
}

function investedCapital(date: string): number {
  if (date < FIRST_BUY_DATE) {
    return 0;
  }

  if (date < SALE_DATE) {
    return 10 * 100 + 5 * 50;
  }

  return 6 * 100 + 5 * 50;
}

describeLive(
  'Open the chart, change the range, toggle the series, then drawdown',
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

    async function press(selector: string) {
      const button = container.querySelector(selector);

      expect(button).toBeInstanceOf(HTMLButtonElement);

      await act(async () => {
        (button as HTMLButtonElement).click();
      });

      await settled();
    }

    function seriesPath(): string | null {
      return (
        container
          .querySelector('[data-testid="chart-series-card"] path')
          ?.getAttribute('d') ?? null
      );
    }

    function drawdownPath(): string | null {
      return (
        container
          .querySelector('[data-testid="drawdown-card"] path')
          ?.getAttribute('d') ?? null
      );
    }

    function kindLabel(): string | null | undefined {
      return container.querySelector('[data-testid="chart-series-kind-label"]')
        ?.textContent;
    }

    it('follows Max into YTD, then invested capital, cash, and drawdown', async () => {
      const maxValue = await fetchChartSeries(
        { kind: 'portfolioValue', range: 'max' },
        session.request
      );

      await render(<InteractiveChart request={session.request} />);
      await settled();

      expect(
        container
          .querySelector('[data-range="max"]')
          ?.getAttribute('aria-pressed')
      ).toBe('true');
      expect(kindLabel()).toBe('Showing Portfolio value');
      expect(
        container.querySelector('[data-testid="drawdown-card"]')
      ).not.toBeNull();
      expect(maxValue.startDate).toBe(DAY_BEFORE_FIRST_BUY);
      expect(maxValue.points[0]).toEqual({
        date: DAY_BEFORE_FIRST_BUY,
        value: 0
      });
      expect(maxValue.points.map(({ date }) => date)).toEqual(
        expect.arrayContaining([FIRST_BUY_DATE, SALE_DATE])
      );
      expect(maxValue.points).toEqual(
        maxValue.points.map(({ date }) => {
          return { date, value: marketValue(date) };
        })
      );
      expect(seriesPath()).toBe(
        toPath(maxValue.points, CHART_WIDTH, CHART_HEIGHT)
      );

      const ytdValue = await fetchChartSeries(
        { kind: 'portfolioValue', range: 'ytd' },
        session.request
      );
      const ytdDrawdown = await fetchDrawdown(
        { range: 'ytd' },
        session.request
      );

      await press('[data-range="ytd"]');

      expect(
        container
          .querySelector('[data-range="ytd"]')
          ?.getAttribute('aria-pressed')
      ).toBe('true');
      expect(
        container
          .querySelector('[data-range="max"]')
          ?.getAttribute('aria-pressed')
      ).toBe('false');
      expect(ytdValue.granularity).toBe('daily');
      expect(ytdValue.startDate).toBe(YTD_START);
      expect(ytdValue.points[0]).toEqual({
        date: YTD_START,
        value: marketValue(YTD_START)
      });
      expect(ytdValue.points.map(({ date }) => date)).toContain(YEAR_START);
      expect(ytdValue.points.every(({ date }) => date >= YTD_START)).toBe(true);
      expect(ytdValue.points).toEqual(
        ytdValue.points.map(({ date }) => {
          return { date, value: marketValue(date) };
        })
      );
      expect(ytdValue.points[ytdValue.points.length - 1]?.value).toBe(
        marketValue(LATEST_PRICE_DATE)
      );
      expect(seriesPath()).toBe(
        toPath(ytdValue.points, CHART_WIDTH, CHART_HEIGHT)
      );
      expect(seriesPath()).not.toBe(
        toPath(maxValue.points, CHART_WIDTH, CHART_HEIGHT)
      );

      const ytdInvested = await fetchChartSeries(
        { kind: 'investedCapital', range: 'ytd' },
        session.request
      );
      const ytdCash = await fetchChartSeries(
        { kind: 'cash', range: 'ytd' },
        session.request
      );

      await press('[data-kind="investedCapital"]');

      expect(kindLabel()).toBe('Showing Invested capital');
      expect(
        container
          .querySelector('[data-kind="investedCapital"]')
          ?.getAttribute('aria-pressed')
      ).toBe('true');
      expect(ytdInvested.points.map(({ date }) => date)).toEqual(
        ytdValue.points.map(({ date }) => date)
      );
      expect(ytdInvested.points).toEqual(
        ytdInvested.points.map(({ date }) => {
          return { date, value: investedCapital(date) };
        })
      );
      expect(seriesPath()).toBe(
        toPath(ytdInvested.points, CHART_WIDTH, CHART_HEIGHT)
      );

      await press('[data-kind="cash"]');

      expect(kindLabel()).toBe('Showing Cash');
      expect(ytdCash.points.every(({ value }) => value === 0)).toBe(true);
      expect(seriesPath()).toBe(
        toPath(ytdCash.points, CHART_WIDTH, CHART_HEIGHT)
      );
      expect(container.querySelector('[role="alert"]')).toBeNull();

      // YTD starts after the fee drag and the 2025-06-02 sale. Prices only
      // rise after that, so the window is a peak the whole way. Drawdown
      // already shares this range on the same InteractiveChart.
      expect(ytdDrawdown.granularity).toBe('daily');
      expect(ytdDrawdown.points.length).toBeGreaterThan(1);
      expect(
        ytdDrawdown.points.every(
          ({ drawdown: value, isNewPeak }) => value === 0 && isNewPeak
        )
      ).toBe(true);
      expect(ytdDrawdown.maxDrawdown).toBe(0);
      expect(
        container.querySelector('[data-testid="drawdown-max"]')?.textContent
      ).toBe(
        `Max drawdown ${formatDrawdownPercent(ytdDrawdown.maxDrawdown)} on ${ytdDrawdown.maxDrawdownDate}`
      );
      expect(drawdownPath()).toBe(
        toPath(
          ytdDrawdown.points.map(({ date, drawdown: value }) => {
            return { date, value };
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
