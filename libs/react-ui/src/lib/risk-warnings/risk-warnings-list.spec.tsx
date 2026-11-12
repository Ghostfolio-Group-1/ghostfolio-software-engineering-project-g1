import { renderToStaticMarkup } from 'react-dom/server';

import { RiskWarningsList } from './risk-warnings-list';
import type { RiskWarning } from './risk-warnings.client';

const warningFixture: RiskWarning = {
  actual: 0.33,
  message: 'AAPL is 33% of your portfolio, above the 25% red limit.',
  ruleKey: 'SingleStockConcentration',
  severity: 'RED',
  subject: { type: 'stock', value: 'AAPL' },
  threshold: 0.25
};

describe('RiskWarningsList', () => {
  it('shows the loading state', () => {
    const html = renderToStaticMarkup(<RiskWarningsList status="loading" />);

    expect(html).toContain('aria-busy="true"');
  });

  it('shows the empty state when there are no warnings', () => {
    const html = renderToStaticMarkup(
      <RiskWarningsList status="empty" warnings={[]} />
    );

    expect(html).toContain('No active warnings');
  });

  it('shows the error state with a retry action', () => {
    const html = renderToStaticMarkup(
      <RiskWarningsList
        errorMessage="Warnings are unavailable right now"
        onRetry={() => {}}
        status="error"
      />
    );

    expect(html).toContain('role="alert"');
    expect(html).toContain('Warnings are unavailable right now');
    expect(html).toContain('Try again');
  });

  it('renders one row per warning with its severity, subject and message', () => {
    const html = renderToStaticMarkup(
      <RiskWarningsList status="ready" warnings={[warningFixture]} />
    );

    expect(html).toContain('Stock: AAPL');
    expect(html).toContain(
      'AAPL is 33% of your portfolio, above the 25% red limit.'
    );
    expect(html).toContain('aria-label="Red"');
  });

  it('renders a row per warning, each with its own list item', () => {
    const second: RiskWarning = {
      ...warningFixture,
      severity: 'YELLOW',
      subject: { type: 'sector', value: 'Technology' }
    };

    const html = renderToStaticMarkup(
      <RiskWarningsList status="ready" warnings={[warningFixture, second]} />
    );

    expect(html.match(/<li/g)).toHaveLength(2);
    expect(html).toContain('Sector: Technology');
  });
});
