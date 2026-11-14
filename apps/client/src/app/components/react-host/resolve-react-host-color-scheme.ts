import type { ColorScheme } from '@ghostfolio/common/types';

export interface ResolveReactHostColorSchemeOptions {
  documentHasDarkClass: boolean;
  documentHasLightClass: boolean;
  scheme: ColorScheme | null | undefined;
  systemPrefersDark: boolean;
}

/**
 * Match app.component initializeTheme(): explicit DARK/LIGHT win; otherwise
 * follow the document theme class, then the OS preference. Never force the
 * light Card surface when the Angular shell is already dark.
 */
export function resolveReactHostColorScheme({
  documentHasDarkClass,
  documentHasLightClass,
  scheme,
  systemPrefersDark
}: ResolveReactHostColorSchemeOptions): ColorScheme {
  if (scheme === 'DARK' || scheme === 'LIGHT') {
    return scheme;
  }

  if (documentHasDarkClass) {
    return 'DARK';
  }

  if (documentHasLightClass) {
    return 'LIGHT';
  }

  return systemPrefersDark ? 'DARK' : 'LIGHT';
}

export function systemPrefersDarkColorScheme(): boolean {
  if (
    typeof window === 'undefined' ||
    typeof window.matchMedia !== 'function'
  ) {
    return false;
  }

  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}
