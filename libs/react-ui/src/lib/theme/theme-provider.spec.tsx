import { renderToStaticMarkup } from 'react-dom/server';

import { darkTheme, lightTheme } from './theme';
import { ThemeProvider, useTheme } from './theme-provider';

function Probe() {
  return <span>{useTheme().name}</span>;
}

describe('ThemeProvider', () => {
  it('should default to the light theme', () => {
    expect(renderToStaticMarkup(<Probe />)).toBe('<span>light</span>');
  });

  it('should provide the dark theme when requested', () => {
    const html = renderToStaticMarkup(
      <ThemeProvider theme={darkTheme}>
        <Probe />
      </ThemeProvider>
    );

    expect(html).toBe('<span>dark</span>');
  });

  it('should keep the brand color in both themes', () => {
    expect(lightTheme.color.primary).toBe('#36cfcc');
    expect(darkTheme.color.primary).toBe('#36cfcc');
  });
});
