import { renderToStaticMarkup } from 'react-dom/server';

import { DashboardRiskSummary } from './dashboard-risk-summary';

const buckets = [
  { name: 'SAP', percentage: 0.1, severity: 'GREEN' as const },
  { name: 'AAPL', percentage: 0.4, severity: 'RED' as const },
  { name: 'MSFT', percentage: 0.35, severity: 'YELLOW' as const },
  { name: 'NVDA', percentage: 0.15, severity: 'NO_DATA' as const }
];

describe('DashboardRiskSummary', () => {
  it('lists the largest positions first, limited to the given count', () => {
    const html = renderToStaticMarkup(
      <DashboardRiskSummary buckets={buckets} limit={3} />
    );

    expect(html.indexOf('AAPL')).toBeLessThan(html.indexOf('MSFT'));
    expect(html.indexOf('MSFT')).toBeLessThan(html.indexOf('NVDA'));
    expect(html).not.toContain('SAP');
    expect(html).toContain('40.0%');
  });

  it('shows severity as text, not only colour', () => {
    const html = renderToStaticMarkup(
      <DashboardRiskSummary buckets={buckets} />
    );

    expect(html).toContain('High');
    expect(html).toContain('Watch');
    expect(html).toContain('OK');
    expect(html).toContain('No data');
  });

  it('calls out a holding over the limit', () => {
    const html = renderToStaticMarkup(
      <DashboardRiskSummary buckets={buckets} />
    );

    expect(html).toContain('AAPL exceeds the single-stock limit');
  });

  it('says so when no holding is over the limit', () => {
    const html = renderToStaticMarkup(
      <DashboardRiskSummary buckets={[buckets[0], buckets[2]]} />
    );

    expect(html).toContain('No single stock exceeds the concentration limit');
  });

  it('shows API fractions as percentages', () => {
    const html = renderToStaticMarkup(
      <DashboardRiskSummary
        buckets={[{ name: 'AAPL', percentage: 0.9507, severity: 'RED' }]}
      />
    );

    expect(html).toContain('95.1%');
  });

  it('shows shares only, with no limit claim, while every bucket is NO_DATA', () => {
    const html = renderToStaticMarkup(
      <DashboardRiskSummary
        buckets={[
          { name: 'AAPL', percentage: 0.95, severity: 'NO_DATA' },
          { name: 'MSFT', percentage: 0.05, severity: 'NO_DATA' }
        ]}
      />
    );

    expect(html).toContain('95.0%');
    expect(html).not.toContain('Concentration');
    expect(html).not.toContain('No data');
    expect(html).not.toContain('exceeds');
  });
});
