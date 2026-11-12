import { renderToStaticMarkup } from 'react-dom/server';

import type { AuthenticatedFetch } from '../data/api-request';
import { RiskPage } from './risk-page';

describe('RiskPage', () => {
  it('renders the Risk dashboard, Warnings, Target allocation, Thresholds and the What-if simulator, in that order', () => {
    const html = renderToStaticMarkup(
      <RiskPage request={jest.fn() as unknown as AuthenticatedFetch} />
    );

    expect(html).toContain('>Risk<');
    expect(html).toContain('>Warnings<');
    expect(html).toContain('>Target allocation<');
    expect(html).toContain('>Thresholds<');
    expect(html).toContain('Drop percentage');
    expect(html).toContain('Run simulation');
    expect(html.indexOf('>Risk<')).toBeLessThan(html.indexOf('>Warnings<'));
    expect(html.indexOf('>Warnings<')).toBeLessThan(
      html.indexOf('>Target allocation<')
    );
    expect(html.indexOf('>Target allocation<')).toBeLessThan(
      html.indexOf('>Thresholds<')
    );
    expect(html.indexOf('>Thresholds<')).toBeLessThan(
      html.indexOf('Drop percentage')
    );
  });
});
