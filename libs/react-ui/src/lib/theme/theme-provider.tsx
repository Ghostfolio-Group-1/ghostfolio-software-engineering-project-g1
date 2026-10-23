import { createContext, useContext } from 'react';
import type { ReactNode } from 'react';

import { lightTheme } from './theme';
import type { Theme } from './theme';

const ThemeContext = createContext(lightTheme);

export interface ThemeProviderProps {
  children?: ReactNode;
  theme?: Theme;
}

export function ThemeProvider({
  children,
  theme = lightTheme
}: ThemeProviderProps) {
  return (
    <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>
  );
}

export function useTheme(): Theme {
  return useContext(ThemeContext);
}
