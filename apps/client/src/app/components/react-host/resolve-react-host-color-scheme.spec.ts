import {
  resolveReactHostColorScheme,
  systemPrefersDarkColorScheme
} from './resolve-react-host-color-scheme';

describe('resolveReactHostColorScheme', () => {
  it('honors an explicit DARK preference', () => {
    expect(
      resolveReactHostColorScheme({
        documentHasDarkClass: false,
        documentHasLightClass: true,
        scheme: 'DARK',
        systemPrefersDark: false
      })
    ).toBe('DARK');
  });

  it('honors an explicit LIGHT preference', () => {
    expect(
      resolveReactHostColorScheme({
        documentHasDarkClass: true,
        documentHasLightClass: false,
        scheme: 'LIGHT',
        systemPrefersDark: true
      })
    ).toBe('LIGHT');
  });

  it('follows the document dark class when preference is unset', () => {
    expect(
      resolveReactHostColorScheme({
        documentHasDarkClass: true,
        documentHasLightClass: false,
        scheme: undefined,
        systemPrefersDark: false
      })
    ).toBe('DARK');
  });

  it('follows the OS preference when document theme is unset', () => {
    expect(
      resolveReactHostColorScheme({
        documentHasDarkClass: false,
        documentHasLightClass: false,
        scheme: null,
        systemPrefersDark: true
      })
    ).toBe('DARK');
  });
});

describe('systemPrefersDarkColorScheme', () => {
  it('returns false when matchMedia is unavailable', () => {
    const original = window.matchMedia;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (window as any).matchMedia;

    expect(systemPrefersDarkColorScheme()).toBe(false);

    window.matchMedia = original;
  });
});
