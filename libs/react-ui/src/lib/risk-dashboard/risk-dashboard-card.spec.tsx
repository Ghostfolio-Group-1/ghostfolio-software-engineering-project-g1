import { renderToStaticMarkup } from 'react-dom/server';

import { darkTheme } from '../theme/theme';
import { ThemeProvider } from '../theme/theme-provider';
import { RiskDashboardCard, RiskDashboardSummary } from './risk-dashboard-card';

const summary: RiskDashboardSummary = {
  categories: [
    { key: 'concentration', name: 'Concentration', score: 45, severity: 'RED' },
    { key: 'volatility', name: 'Volatility', score: 100, severity: 'GREEN' },
    { key: 'cash', name: 'Cash Allocation', score: 100, severity: 'GREEN' },
    {
      key: 'targetAllocation',
      name: 'Target Allocation',
      score: 80,
      severity: 'YELLOW'
    }
  ],
  grade: 'C',
  score: 72,
  severity: 'YELLOW',
  topConcentration: {
    name: 'Apple Inc.',
    percentage: 0.333,
    severity: 'RED'
  }
};

describe('RiskDashboardCard', () => {
  it('shows a loading state and hides the score', () => {
    const html = renderToStaticMarkup(
      <RiskDashboardCard data={summary} status="loading" />
    );

    expect(html).toContain('Risk');
    expect(html).toContain('role="status"');
    expect(html).toContain('aria-busy="true"');
    expect(html).not.toContain('risk-score-value');
  });

  it('shows an error state with a retry button', () => {
    const onRetry = jest.fn();
    const html = renderToStaticMarkup(
      <RiskDashboardCard
        errorMessage="Could not load your risk score"
        onRetry={onRetry}
        status="error"
      />
    );

    expect(html).toContain('role="alert"');
    expect(html).toContain('Could not load your risk score');
    expect(html).toContain('Try again');
  });

  it('uses a default error message when none is given', () => {
    expect(
      renderToStaticMarkup(<RiskDashboardCard status="error" />)
    ).toContain('Risk data is unavailable');
  });

  it('shows an empty state when there are no holdings', () => {
    const html = renderToStaticMarkup(<RiskDashboardCard status="empty" />);

    expect(html).toContain('No holdings yet');
    expect(html).not.toContain('risk-score-value');
  });

  it('renders the score, grade and overall severity indicator when ready', () => {
    const html = renderToStaticMarkup(
      <RiskDashboardCard data={summary} status="ready" />
    );

    expect(html).toContain('data-testid="risk-score-value"');
    expect(html).toContain('>72<');
    expect(html).toContain('Grade C');
    expect(html).toContain('aria-label="Overall: Yellow"');
  });

  // Severity must be understandable without relying on color alone - the
  // word, not just the dot/aria-label, has to be visible (Tharun's review
  // on PR #211).
  it('shows the severity word visibly, not only in the aria-label', () => {
    const html = renderToStaticMarkup(
      <RiskDashboardCard data={summary} status="ready" />
    );

    // Visible text sibling of the (aria-hidden) dot, once per severity used
    // above: Overall (Yellow), top concentration (Red), and the four
    // category rows (Red, Green, Green, Yellow).
    expect(html.split('>Yellow<').length - 1).toBeGreaterThanOrEqual(2);
    expect(html.split('>Red<').length - 1).toBeGreaterThanOrEqual(2);
    expect(html.split('>Green<').length - 1).toBeGreaterThanOrEqual(2);
  });

  it('shows a message instead of a dash when the score is unavailable', () => {
    const html = renderToStaticMarkup(
      <RiskDashboardCard
        data={{
          categories: [],
          grade: null,
          score: null,
          severity: 'NO_DATA',
          unavailableReason: 'NO_ACTIVE_RULES'
        }}
        status="ready"
      />
    );

    expect(html).toContain('data-testid="risk-score-unavailable-reason"');
    expect(html).toContain('no active risk rules');
    expect(html).toContain('>—<'); // the score value itself is still a dash
  });

  it('falls back to a generic message for an unrecognized unavailableReason', () => {
    const html = renderToStaticMarkup(
      <RiskDashboardCard
        data={{
          categories: [],
          grade: null,
          score: null,
          severity: 'NO_DATA',
          unavailableReason: 'SOME_FUTURE_REASON'
        }}
        status="ready"
      />
    );

    expect(html).toContain('not available right now');
  });

  it('shows no unavailable-reason message when the score is present', () => {
    const html = renderToStaticMarkup(
      <RiskDashboardCard data={summary} status="ready" />
    );

    expect(html).not.toContain('risk-score-unavailable-reason');
  });

  it('renders the top concentration from GET /risk/concentration with its severity', () => {
    const html = renderToStaticMarkup(
      <RiskDashboardCard data={summary} status="ready" />
    );

    expect(html).toContain('Top concentration: Apple Inc. (33.3%)');
    expect(html).toContain('background-color:#dc3545'); // RED dot
  });

  it('renders one indicator row per category (concentration, volatility, cash, target allocation)', () => {
    const html = renderToStaticMarkup(
      <RiskDashboardCard data={summary} status="ready" />
    );

    for (const category of summary.categories) {
      expect(html).toContain(category.name);
    }
    // Volatility and Cash are both GREEN -> both dots use the success colour.
    expect(
      html.split('background-color:#28a745').length - 1
    ).toBeGreaterThanOrEqual(2);
  });

  it('renders nothing extra when there is no ready data yet', () => {
    const html = renderToStaticMarkup(<RiskDashboardCard status="ready" />);

    expect(html).not.toContain('risk-score-value');
  });

  it('uses the active theme for the grade text', () => {
    const html = renderToStaticMarkup(
      <ThemeProvider theme={darkTheme}>
        <RiskDashboardCard data={summary} status="ready" />
      </ThemeProvider>
    );

    expect(html).toContain('color:#bdbdbd');
  });
});
