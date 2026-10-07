export const designTokens = {
  borderRadius: { lg: 12, md: 8, sm: 4 },
  color: {
    background: '#ffffff',
    border: '#e0e0e0',
    danger: '#dc3545',
    primary: '#36cfcc',
    secondary: '#3686cf',
    success: '#28a745',
    surface: '#fafafa',
    text: '#212121',
    textMuted: '#757575'
  },
  fontFamily: "'Inter', 'Roboto', 'Helvetica Neue', sans-serif",
  fontSize: { lg: 20, md: 16, sm: 14, xl: 28 },
  spacing: { lg: 24, md: 16, sm: 8, xl: 32, xs: 4 }
} as const;

export type DesignTokens = typeof designTokens;

export function px(value: number): string {
  return `${value}px`;
}
