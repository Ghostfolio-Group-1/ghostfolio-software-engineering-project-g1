import { renderToStaticMarkup } from 'react-dom/server';

import {
  RiskIndicator,
  SEVERITY_COLOR,
  SEVERITY_LABEL
} from './risk-indicator';
import type { RiskSeverity } from './risk-indicator';

describe('RiskIndicator', () => {
  // One test per severity-to-colour mapping (Mon Nov 9, issue #188).
  it.each<[RiskSeverity, string]>([
    ['GREEN', '#28a745'],
    ['YELLOW', '#ffc107'],
    ['RED', '#dc3545'],
    ['NO_DATA', '#9e9e9e']
  ])('renders %s with colour %s', (severity, color) => {
    const html = renderToStaticMarkup(<RiskIndicator severity={severity} />);

    expect(SEVERITY_COLOR[severity]).toBe(color);
    expect(html).toContain(`background-color:${color}`);
    expect(html).toContain(`data-severity="${severity}"`);
  });

  it('exposes an accessible label built from the severity alone when no label is given', () => {
    const html = renderToStaticMarkup(<RiskIndicator severity="RED" />);

    expect(html).toContain(`aria-label="${SEVERITY_LABEL.RED}"`);
    expect(html).toContain('role="status"');
  });

  it('prefixes the accessible label and renders the visible label when given', () => {
    const html = renderToStaticMarkup(
      <RiskIndicator label="AAPL concentration" severity="YELLOW" />
    );

    expect(html).toContain('aria-label="AAPL concentration: Yellow"');
    expect(html).toContain('>AAPL concentration<');
  });

  it('hides the dot from the accessibility tree', () => {
    const html = renderToStaticMarkup(<RiskIndicator severity="GREEN" />);

    expect(html).toContain('aria-hidden="true"');
  });

  // Severity must be understandable without relying on colour alone - the
  // word, not just the dot/aria-label, has to be visible (Tharun's review
  // on PR #211, carried over to this shared component).
  it('shows the severity word visibly, not only in the aria-label', () => {
    const html = renderToStaticMarkup(<RiskIndicator severity="YELLOW" />);

    expect(html).toContain('>Yellow<');
  });
});
