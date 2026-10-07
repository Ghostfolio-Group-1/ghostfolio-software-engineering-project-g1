import { renderToStaticMarkup } from 'react-dom/server';

import { designTokens } from '../tokens/design-tokens';
import { LayoutShell } from './layout-shell';

describe('LayoutShell', () => {
  it('should render the title and children', () => {
    const html = renderToStaticMarkup(
      <LayoutShell title="Portfolio Overview">
        <p>Dashboard content</p>
      </LayoutShell>
    );

    expect(html).toContain('Portfolio Overview');
    expect(html).toContain('<p>Dashboard content</p>');
  });

  it('should use the shared design tokens', () => {
    const html = renderToStaticMarkup(<LayoutShell title="Test" />);

    expect(html).toContain(designTokens.color.primary);
    expect(html).toContain('padding:24px');
  });
});
