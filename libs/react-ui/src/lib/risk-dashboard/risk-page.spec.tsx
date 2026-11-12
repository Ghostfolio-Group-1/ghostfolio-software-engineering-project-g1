import { renderToStaticMarkup } from 'react-dom/server';

import type { AuthenticatedFetch } from '../data/api-request';
import { RiskPage } from './risk-page';

describe('RiskPage', () => {
  it('renders the Risk dashboard and the What-if simulator, dashboard first', () => {
    const html = renderToStaticMarkup(
      <RiskPage request={jest.fn() as unknown as AuthenticatedFetch} />
    );

    expect(html).toContain('>Risk<');
    expect(html).toContain('Drop percentage');
    expect(html).toContain('Run simulation');
    expect(html.indexOf('>Risk<')).toBeLessThan(
      html.indexOf('Drop percentage')
    );
  });
});
