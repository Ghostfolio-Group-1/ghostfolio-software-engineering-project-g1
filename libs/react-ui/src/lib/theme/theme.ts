import { designTokens } from '../tokens/design-tokens';

export interface Theme {
  color: {
    background: string;
    border: string;
    primary: string;
    primaryText: string;
    surface: string;
    text: string;
    textMuted: string;
  };
  name: 'dark' | 'light';
}

export const lightTheme: Theme = {
  color: {
    background: designTokens.color.background,
    border: designTokens.color.border,
    primary: designTokens.color.primary,
    primaryText: designTokens.color.text,
    surface: designTokens.color.surface,
    text: designTokens.color.text,
    textMuted: designTokens.color.textMuted
  },
  name: 'light'
};

export const darkTheme: Theme = {
  color: {
    background: '#121212',
    border: '#424242',
    primary: designTokens.color.primary,
    primaryText: '#121212',
    surface: '#1e1e1e',
    text: '#fafafa',
    textMuted: '#bdbdbd'
  },
  name: 'dark'
};
