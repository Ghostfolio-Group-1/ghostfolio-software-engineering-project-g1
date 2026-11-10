import { renderToStaticMarkup } from 'react-dom/server';

import { DashboardPage } from './dashboard-page';

describe('DashboardPage', () => {
  it('renders the page title and one card per section in order', () => {
    const html = renderToStaticMarkup(<DashboardPage />);

    expect(html).toContain('Portfolio overview');
    expect(html.match(/<section/g)).toHaveLength(3);
    expect(html.indexOf('Portfolio risk')).toBeLessThan(html.indexOf('Tax'));
    expect(html.indexOf('Tax')).toBeLessThan(html.indexOf('Performance'));
  });

  it('shows every section as loading by default', () => {
    const html = renderToStaticMarkup(<DashboardPage />);

    expect(html.match(/aria-busy="true"/g)).toHaveLength(3);
  });

  it('renders each section in its own state', () => {
    const html = renderToStaticMarkup(
      <DashboardPage
        sections={{
          charts: { status: 'empty' },
          risk: { content: <p>Score 72</p>, status: 'ready' },
          tax: {
            errorMessage: 'The tax section could not be loaded',
            status: 'error'
          }
        }}
      />
    );

    expect(html).toContain('<p>Score 72</p>');
    expect(html).toContain('role="alert"');
    expect(html).toContain('The tax section could not be loaded');
    expect(html).toContain('No data yet');
    expect(html).not.toContain('aria-busy="true"');
  });

  it('keeps the other sections when one fails', () => {
    const html = renderToStaticMarkup(
      <DashboardPage
        sections={{
          charts: { content: <p>Chart</p>, status: 'ready' },
          risk: { content: <p>Risk</p>, status: 'ready' },
          tax: { status: 'error' }
        }}
      />
    );

    expect(html).toContain('<p>Risk</p>');
    expect(html).toContain('<p>Chart</p>');
    expect(html.match(/role="alert"/g)).toHaveLength(1);
  });

  it('renders a notice above the cards when one is given', () => {
    const html = renderToStaticMarkup(
      <DashboardPage notice={<p>Heads up</p>} />
    );

    expect(html.indexOf('<p>Heads up</p>')).toBeGreaterThan(-1);
    expect(html.indexOf('<p>Heads up</p>')).toBeLessThan(
      html.indexOf('dashboard-grid')
    );
  });

  it('lays the cards out in a responsive grid', () => {
    const html = renderToStaticMarkup(<DashboardPage title="Overview" />);

    expect(html).toContain('Overview');
    expect(html).toContain(
      'grid-template-columns:repeat(auto-fit, minmax(280px, 1fr))'
    );
  });
});
