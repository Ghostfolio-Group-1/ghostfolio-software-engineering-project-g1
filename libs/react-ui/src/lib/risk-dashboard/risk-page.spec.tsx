import { renderToStaticMarkup } from 'react-dom/server';

import type { AuthenticatedFetch } from '../data/api-request';
import { RiskPage } from './risk-page';

describe('RiskPage', () => {
  // Layout redesign (issue #<ISSUE_NUMBER>): the page header, dashboard
  // summary and Warnings are full-width, then a two-column grid holds
  // Thresholds on the left and Target allocation + Stress test stacked on
  // the right (design spec Section 4) - DOM order follows the same
  // left-column-then-right-column order, which is also what a 2-column
  // CSS grid with no explicit `order` renders visually.
  it('renders the Risk dashboard, Warnings, Thresholds, Target allocation and the What-if simulator, in that order', () => {
    const html = renderToStaticMarkup(
      <RiskPage request={jest.fn() as unknown as AuthenticatedFetch} />
    );

    expect(html).toContain('>Risk<');
    expect(html).toContain('>Warnings<');
    expect(html).toContain('>Thresholds<');
    expect(html).toContain('>Target allocation<');
    expect(html).toContain('Drop percentage');
    expect(html).toContain('Run simulation');
    expect(html.indexOf('>Risk<')).toBeLessThan(html.indexOf('>Warnings<'));
    expect(html.indexOf('>Warnings<')).toBeLessThan(
      html.indexOf('>Thresholds<')
    );
    expect(html.indexOf('>Thresholds<')).toBeLessThan(
      html.indexOf('>Target allocation<')
    );
    expect(html.indexOf('>Target allocation<')).toBeLessThan(
      html.indexOf('Drop percentage')
    );
  });

  it('shows a page subtitle describing what the Risk module monitors', () => {
    const html = renderToStaticMarkup(
      <RiskPage request={jest.fn() as unknown as AuthenticatedFetch} />
    );

    expect(html).toContain(
      'Monitor concentration, cash allocation, and stress scenarios.'
    );
  });
});
