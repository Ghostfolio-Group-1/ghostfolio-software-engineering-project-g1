import { useTheme } from '../theme/theme-provider';

// A richer semantic palette for the Risk module's redesign (issue
// #<ISSUE_NUMBER>), layered on top of the existing Theme (theme/theme.ts)
// rather than editing it: Theme is consumed by Button/Card/DashboardCard
// and every other module (Tax, charts, ...), so widening it here - keyed
// off the same `theme.name` the host already switches reactively
// (GfReactHostComponent re-renders with lightTheme/darkTheme whenever the
// user's colorScheme setting changes, no reload) - gets the exact same
// instant, flash-free light/dark behaviour for free, without touching a
// file every other module also depends on.
export interface RiskPalette {
  accent: string;
  accentContrast: string;
  accentHover: string;
  bgCard: string;
  bgElevated: string;
  bgHover: string;
  bgPage: string;
  border: string;
  borderStrong: string;
  focusRing: string;
  shadowCard: string;
  statusGreen: string;
  statusGreenBg: string;
  statusRed: string;
  statusRedBg: string;
  statusYellow: string;
  statusYellowBg: string;
  textMuted: string;
  textPrimary: string;
  textSecondary: string;
}

// Starting-point values from the design spec. Status colours are re-tuned
// per theme on purpose (a bright dark-mode yellow reads unreadable on a
// light card) rather than reused as-is between the two palettes.
const lightRiskPalette: RiskPalette = {
  // #0A7A6E rather than the spec's literal #0D9488 starting point: #0D9488
  // against white (the button-label pairing below) is only 3.74:1 - it
  // clears the 3:1 UI-component minimum but not 4.5:1 for body-sized text.
  // This shade keeps the same teal hue at 5.22:1 (verified with the WCAG
  // relative-luminance formula; see the contrast check in the PR).
  accent: '#0A7A6E',
  accentContrast: '#FFFFFF',
  accentHover: '#086159',
  bgCard: '#FFFFFF',
  bgElevated: '#F1F4F8',
  bgHover: 'rgba(15, 23, 42, 0.04)',
  bgPage: '#F5F7FA',
  border: 'rgba(15, 23, 42, 0.10)',
  borderStrong: 'rgba(15, 23, 42, 0.22)',
  focusRing: 'rgba(13, 148, 136, 0.45)',
  shadowCard:
    '0 1px 2px rgba(15, 23, 42, 0.06), 0 1px 1px rgba(15, 23, 42, 0.04)',
  statusGreen: '#15803D',
  statusGreenBg: 'rgba(21, 128, 61, 0.1)',
  statusRed: '#B91C1C',
  statusRedBg: 'rgba(185, 28, 28, 0.1)',
  statusYellow: '#B45309',
  statusYellowBg: 'rgba(180, 83, 9, 0.12)',
  textMuted: '#64748B',
  textPrimary: '#0F172A',
  textSecondary: '#475569'
};

const darkRiskPalette: RiskPalette = {
  accent: '#2DD4BF',
  accentContrast: '#0B1110',
  accentHover: '#5EE6D4',
  bgCard: '#171A21',
  bgElevated: '#1E222B',
  bgHover: 'rgba(255, 255, 255, 0.06)',
  bgPage: '#0F1115',
  border: 'rgba(255, 255, 255, 0.08)',
  borderStrong: 'rgba(255, 255, 255, 0.18)',
  focusRing: 'rgba(45, 212, 191, 0.5)',
  shadowCard: 'none',
  statusGreen: '#4ADE80',
  statusGreenBg: 'rgba(74, 222, 128, 0.14)',
  statusRed: '#F87171',
  statusRedBg: 'rgba(248, 113, 113, 0.16)',
  statusYellow: '#FBBF24',
  statusYellowBg: 'rgba(251, 191, 36, 0.16)',
  textMuted: '#9AA3AF',
  textPrimary: '#E8EAED',
  textSecondary: '#C2C8D1'
};

export const RISK_PALETTE: Record<'dark' | 'light', RiskPalette> = {
  dark: darkRiskPalette,
  light: lightRiskPalette
};

export function useRiskPalette(): RiskPalette {
  const theme = useTheme();

  return RISK_PALETTE[theme.name];
}
