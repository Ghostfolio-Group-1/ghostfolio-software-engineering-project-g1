import { renderToStaticMarkup } from 'react-dom/server';

import {
  chartKindLabel,
  DashboardChartsSummary
} from './dashboard-charts-summary';

const points = [
  { date: '2026-01-05', value: 3000 },
  { date: '2026-02-02', value: 3550.5 },
  { date: '2026-04-01', value: 4100 }
];

describe('DashboardChartsSummary', () => {
  it('shows the latest value as the API sends it, with its date and kind', () => {
    const html = renderToStaticMarkup(
      <DashboardChartsSummary kind="portfolioValue" points={points} />
    );

    expect(html).toContain('4,100.00');
    expect(html).toContain('Portfolio value on 2026-04-01');
    expect(html).toContain('2026-01-05 – 2026-04-01 · 3 points');
  });

  it('draws a labelled sparkline for screen readers', () => {
    const html = renderToStaticMarkup(
      <DashboardChartsSummary kind="portfolioValue" points={points} />
    );

    expect(html).toContain('role="img"');
    expect(html).toContain(
      'aria-label="Portfolio value from 2026-01-05 to 2026-04-01"'
    );
    expect(html).toMatch(/<path d="M/);
  });

  it('uses the singular for one point', () => {
    const html = renderToStaticMarkup(
      <DashboardChartsSummary kind="cash" points={[points[0]]} />
    );

    expect(html).toContain('Cash on 2026-01-05');
    expect(html).toContain('· 1 point<');
  });

  it('renders nothing without points (the card shows its empty state)', () => {
    expect(
      renderToStaticMarkup(
        <DashboardChartsSummary kind="portfolioValue" points={[]} />
      )
    ).toBe('');
  });

  it('labels every series kind and falls back for unknown ones', () => {
    expect(chartKindLabel('investedCapital')).toBe('Invested capital');
    expect(chartKindLabel('somethingNew')).toBe('Performance');
  });
});
