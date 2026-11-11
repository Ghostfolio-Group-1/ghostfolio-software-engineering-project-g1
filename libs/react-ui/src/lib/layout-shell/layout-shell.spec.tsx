import { renderToStaticMarkup } from 'react-dom/server';

import { darkTheme, lightTheme } from '../theme/theme';
import { ThemeProvider } from '../theme/theme-provider';
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

  it('should not paint its own background over the host page', () => {
    const html = renderToStaticMarkup(<LayoutShell title="Test" />);

    expect(html).toContain('background-color:transparent');
  });

  it('should use the light theme text colour by default', () => {
    const html = renderToStaticMarkup(<LayoutShell title="Test" />);

    expect(html).toContain(`color:${lightTheme.color.text}`);
  });

  it('should use the dark theme text colour in dark mode', () => {
    const html = renderToStaticMarkup(
      <ThemeProvider theme={darkTheme}>
        <LayoutShell title="Test" />
      </ThemeProvider>
    );

    expect(html).toContain(`color:${darkTheme.color.text}`);
    expect(html).not.toContain(`color:${lightTheme.color.text};`);
  });
});
