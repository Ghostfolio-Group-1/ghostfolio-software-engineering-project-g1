import { renderToStaticMarkup } from 'react-dom/server';

import { darkTheme } from '../theme/theme';
import { ThemeProvider } from '../theme/theme-provider';
import { Card } from './card';

describe('Card', () => {
  it('should render the title and children', () => {
    const html = renderToStaticMarkup(
      <Card title="Risk">
        <p>Body</p>
      </Card>
    );

    expect(html).toContain('<h2');
    expect(html).toContain('Risk');
    expect(html).toContain('<p>Body</p>');
    expect(html).toContain('border-radius:8px');
  });

  it('should omit the heading when there is no title', () => {
    expect(renderToStaticMarkup(<Card />)).not.toContain('<h2');
  });

  it('should use the surface color of the active theme', () => {
    const html = renderToStaticMarkup(
      <ThemeProvider theme={darkTheme}>
        <Card title="Tax" />
      </ThemeProvider>
    );

    expect(html).toContain('background-color:#1e1e1e');
  });
});
