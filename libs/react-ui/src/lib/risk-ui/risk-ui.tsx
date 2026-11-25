import type { CSSProperties, ChangeEvent, ReactNode } from 'react';

import { designTokens, px } from '../tokens/design-tokens';
import type { RiskPalette } from './risk-palette';
import { useRiskPalette } from './risk-palette';

// Shared presentational primitives for the Risk module's redesign (issue
// #<ISSUE_NUMBER>). New, Risk-owned file rather than edits to the shared
// Button/Card/DashboardCard - those are used by Tax, the chart cards and
// the dashboard overview too, so changing their look here would ripple
// into modules this task has no business touching.

// Text that should be announced to a screen reader (an in-progress status,
// for example) without being visible once there's a nicer visual
// equivalent (a skeleton, an icon) alongside it.
export function VisuallyHidden({ children }: { children: ReactNode }) {
  return (
    <span
      style={{
        border: 0,
        clip: 'rect(0, 0, 0, 0)',
        clipPath: 'inset(50%)',
        height: 1,
        margin: -1,
        overflow: 'hidden',
        padding: 0,
        position: 'absolute',
        whiteSpace: 'nowrap',
        width: 1
      }}
    >
      {children}
    </span>
  );
}

export interface RiskCardProps {
  children?: ReactNode;
  style?: CSSProperties;
}

// The 16px-radius/24px-padding/soft-shadow card shell every Risk section
// sits in. Deliberately not the shared Card - that one takes a fixed 8px
// radius and a plain border with no theme-aware shadow, both because
// every one of its other consumers (Tax, charts, the dashboard overview)
// expects exactly that look today.
export function RiskCard({ children, style }: RiskCardProps) {
  const palette = useRiskPalette();

  return (
    <section
      style={{
        backgroundColor: palette.bgCard,
        border: `1px solid ${palette.border}`,
        borderRadius: 16,
        boxShadow: palette.shadowCard,
        color: palette.textPrimary,
        padding: 24,
        ...style
      }}
    >
      {children}
    </section>
  );
}

export interface RiskButtonProps {
  'aria-label'?: string;
  children?: ReactNode;
  disabled?: boolean;
  onClick?: () => void;
  type?: 'button' | 'submit';
  variant?: 'ghost' | 'primary' | 'secondary';
}

// A primary/secondary/ghost button at the 40px height and 10px radius the
// redesign calls for. The shared Button only has primary/secondary, a
// smaller fixed radius, and no className/style escape hatch to adjust
// either - rather than widen that shared component's contract for every
// other module that renders it, this is a separate component used only
// from Risk-owned files.
export function RiskButton({
  'aria-label': ariaLabel,
  children,
  disabled = false,
  onClick,
  type = 'button',
  variant = 'primary'
}: RiskButtonProps) {
  const palette = useRiskPalette();
  const base: CSSProperties = {
    alignItems: 'center',
    border: '1px solid transparent',
    borderRadius: 10,
    cursor: disabled ? 'not-allowed' : 'pointer',
    display: 'inline-flex',
    fontFamily: designTokens.fontFamily,
    fontSize: px(designTokens.fontSize.sm),
    fontWeight: 600,
    gap: px(designTokens.spacing.xs),
    height: 40,
    justifyContent: 'center',
    opacity: disabled ? 0.5 : 1,
    paddingLeft: px(designTokens.spacing.md),
    paddingRight: px(designTokens.spacing.md),
    transition: 'background-color 150ms ease, border-color 150ms ease'
  };
  const variants: Record<string, CSSProperties> = {
    ghost: {
      backgroundColor: 'transparent',
      color: palette.textSecondary
    },
    primary: {
      backgroundColor: palette.accent,
      color: palette.accentContrast
    },
    secondary: {
      backgroundColor: 'transparent',
      borderColor: palette.borderStrong,
      color: palette.textPrimary
    }
  };

  return (
    <button
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={onClick}
      style={{ ...base, ...variants[variant] }}
      type={type}
    >
      {children}
    </button>
  );
}

export interface ToggleProps {
  checked: boolean;
  disabled?: boolean;
  label: ReactNode;
  onChange: (checked: boolean) => void;
}

// A labelled switch, rendered as a real `<input type="checkbox">` (kept
// native for free keyboard/AT support and so existing tests that query
// `input[type="checkbox"]` and read the enclosing <label>'s text keep
// working) with the checkbox itself visually styled as a track/thumb via
// `accentColor` and a bit of sizing - no extra absolutely-positioned thumb
// markup to keep in sync.
export function Toggle({ checked, disabled, label, onChange }: ToggleProps) {
  const palette = useRiskPalette();

  return (
    <label
      style={{
        alignItems: 'center',
        color: palette.textPrimary,
        display: 'inline-flex',
        gap: px(designTokens.spacing.xs)
      }}
    >
      <input
        checked={checked}
        disabled={disabled}
        onChange={(event: ChangeEvent<HTMLInputElement>) =>
          onChange(event.target.checked)
        }
        style={{
          accentColor: palette.accent,
          cursor: disabled ? 'not-allowed' : 'pointer',
          height: 18,
          width: 32
        }}
        type="checkbox"
      />
      <span>{label}</span>
    </label>
  );
}

const fieldLabelStyle = (palette: RiskPalette): CSSProperties => ({
  color: palette.textSecondary,
  display: 'block',
  fontSize: px(designTokens.fontSize.sm),
  fontWeight: 600,
  marginBottom: px(designTokens.spacing.xs)
});

const fieldInputStyle = (
  palette: RiskPalette,
  hasError?: boolean
): CSSProperties => ({
  backgroundColor: palette.bgElevated,
  border: `1px solid ${hasError ? palette.statusRed : palette.border}`,
  borderRadius: 10,
  color: palette.textPrimary,
  fontFamily: designTokens.fontFamily,
  fontSize: px(designTokens.fontSize.sm),
  height: 40,
  padding: `0 ${px(designTokens.spacing.sm)}`,
  width: '100%'
});

export interface PercentFieldProps {
  'aria-label'?: string;
  disabled?: boolean;
  error?: string;
  errorId?: string;
  label?: ReactNode;
  max?: number;
  min?: number;
  onChange: (value: string) => void;
  placeholder?: string;
  value: string;
}

// A labelled percentage input with the "%" suffix rendered inside the
// field, per the design spec, instead of as a floating sibling character.
export function PercentField({
  'aria-label': ariaLabel,
  disabled,
  error,
  errorId,
  label,
  max,
  min,
  onChange,
  placeholder,
  value
}: PercentFieldProps) {
  const palette = useRiskPalette();

  return (
    <div>
      {label ? <span style={fieldLabelStyle(palette)}>{label}</span> : null}
      <div style={{ position: 'relative' }}>
        <input
          aria-describedby={error ? errorId : undefined}
          aria-invalid={error ? true : undefined}
          aria-label={ariaLabel}
          disabled={disabled}
          max={max}
          min={min}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          style={{
            ...fieldInputStyle(palette, Boolean(error)),
            paddingRight: px(designTokens.spacing.lg)
          }}
          type="number"
          value={value}
        />
        <span
          aria-hidden="true"
          style={{
            color: palette.textMuted,
            position: 'absolute',
            right: px(designTokens.spacing.sm),
            top: '50%',
            transform: 'translateY(-50%)'
          }}
        >
          %
        </span>
      </div>
      {error ? (
        <p
          id={errorId}
          role="alert"
          style={{
            color: palette.statusRed,
            fontSize: px(designTokens.fontSize.sm),
            margin: `${px(designTokens.spacing.xs)} 0 0`
          }}
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}

export interface TextFieldProps {
  'aria-label'?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  value: string;
}

export function TextField({
  'aria-label': ariaLabel,
  onChange,
  placeholder,
  value
}: TextFieldProps) {
  const palette = useRiskPalette();

  return (
    <input
      aria-label={ariaLabel}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      style={fieldInputStyle(palette)}
      type="text"
      value={value}
    />
  );
}

export type RiskStatusSeverity = 'GREEN' | 'NO_DATA' | 'RED' | 'YELLOW';

const STATUS_PILL_COLOR: Record<
  RiskStatusSeverity,
  (palette: RiskPalette) => { bg: string; fg: string }
> = {
  GREEN: (palette) => ({ bg: palette.statusGreenBg, fg: palette.statusGreen }),
  NO_DATA: (palette) => ({ bg: palette.bgElevated, fg: palette.textMuted }),
  RED: (palette) => ({ bg: palette.statusRedBg, fg: palette.statusRed }),
  YELLOW: (palette) => ({
    bg: palette.statusYellowBg,
    fg: palette.statusYellow
  })
};

export interface StatusPillProps {
  children: ReactNode;
  severity: RiskStatusSeverity;
}

// A filled pill (icon + colour + text, never colour alone) for use
// alongside the existing RiskIndicator dot - this is the heavier,
// card-header-style badge the design spec calls for; RiskIndicator's own
// dot+word stays exactly as-is everywhere it's already used and tested.
export function StatusPill({ children, severity }: StatusPillProps) {
  const palette = useRiskPalette();
  const { bg, fg } = STATUS_PILL_COLOR[severity](palette);

  return (
    <span
      style={{
        alignItems: 'center',
        backgroundColor: bg,
        borderRadius: 999,
        color: fg,
        display: 'inline-flex',
        fontSize: px(designTokens.fontSize.sm),
        fontWeight: 600,
        gap: px(designTokens.spacing.xs),
        padding: `${px(designTokens.spacing.xs)} ${px(designTokens.spacing.sm)}`
      }}
    >
      {children}
    </span>
  );
}

export interface ChipProps {
  children: ReactNode;
  onClick: () => void;
  selected: boolean;
}

// A filter chip (Warnings card: All / Red / Yellow). A real <button> with
// aria-pressed, not a styled checkbox/radio - there's no form being
// submitted, just a client-side display filter.
export function Chip({ children, onClick, selected }: ChipProps) {
  const palette = useRiskPalette();

  return (
    <button
      aria-pressed={selected}
      onClick={onClick}
      style={{
        backgroundColor: selected ? palette.accent : 'transparent',
        border: `1px solid ${selected ? palette.accent : palette.border}`,
        borderRadius: 999,
        color: selected ? palette.accentContrast : palette.textSecondary,
        cursor: 'pointer',
        fontSize: px(designTokens.fontSize.sm),
        fontWeight: 600,
        padding: `${px(designTokens.spacing.xs)} ${px(designTokens.spacing.sm)}`,
        transition: 'background-color 150ms ease'
      }}
      type="button"
    >
      {children}
    </button>
  );
}

export interface ProgressBarProps {
  // 0-100. Values outside that range are clamped.
  severity: RiskStatusSeverity;
  value: number;
}

// A thin single-colour bar for "how close to the limit is this value".
export function ProgressBar({ severity, value }: ProgressBarProps) {
  const palette = useRiskPalette();
  const clamped = Math.max(0, Math.min(100, value));
  const { fg } = STATUS_PILL_COLOR[severity](palette);

  return (
    <div
      aria-hidden="true"
      style={{
        backgroundColor: palette.bgElevated,
        borderRadius: 999,
        height: 6,
        overflow: 'hidden',
        width: '100%'
      }}
    >
      <div
        style={{
          backgroundColor: fg,
          borderRadius: 999,
          height: '100%',
          transition: 'width 200ms ease',
          width: `${clamped}%`
        }}
      />
    </div>
  );
}

export interface RangeBarProps {
  // All percentages expressed 0-1, same convention as the API (actual,
  // thresholds). redMin/redMax are optional for a one-sided (ceiling)
  // rule, where only a single red line exists.
  actual?: number;
  redMax?: number;
  redMin?: number;
  warnMax?: number;
  warnMin?: number;
}

// A green -> yellow -> red zone bar for a threshold rule's configured
// warning/red lines, with a marker for the current actual value when one
// is available. Purely illustrative (aria-hidden) - the same information
// is already in the labelled percentage fields next to it.
export function RangeBar({
  actual,
  redMax = 1,
  redMin = 0,
  warnMax,
  warnMin
}: RangeBarProps) {
  const palette = useRiskPalette();
  const span = Math.max(redMax - redMin, 0.0001);
  const toPercent = (value: number) =>
    Math.max(0, Math.min(100, ((value - redMin) / span) * 100));

  const hasBand = warnMin !== undefined && warnMax !== undefined;
  const warnStart = hasBand ? toPercent(warnMin as number) : 0;
  const warnEnd = hasBand
    ? toPercent(warnMax as number)
    : toPercent(warnMax ?? redMax);

  return (
    <div
      aria-hidden="true"
      style={{
        backgroundColor: palette.statusRedBg,
        borderRadius: 999,
        height: 8,
        position: 'relative',
        width: '100%'
      }}
    >
      <div
        style={{
          backgroundColor: palette.statusYellowBg,
          borderRadius: 999,
          height: '100%',
          left: `${hasBand ? warnStart : 0}%`,
          position: 'absolute',
          width: `${Math.max(warnEnd - (hasBand ? warnStart : 0), 0)}%`
        }}
      />
      <div
        style={{
          backgroundColor: palette.statusGreenBg,
          borderRadius: 999,
          height: '100%',
          left: `${hasBand ? warnStart : 0}%`,
          position: 'absolute',
          width: hasBand ? '0%' : `${warnEnd}%`
        }}
      />
      {actual !== undefined ? (
        <div
          style={{
            backgroundColor: palette.textPrimary,
            borderRadius: 2,
            height: 12,
            left: `${toPercent(actual)}%`,
            position: 'absolute',
            top: -2,
            width: 2
          }}
        />
      ) : null}
    </div>
  );
}

export interface MetricTileProps {
  children?: ReactNode;
  label: string;
  value: ReactNode;
}

// A labelled stat tile (Top concentration, Concentration score, ...) in
// the summary row's responsive grid.
export function MetricTile({ children, label, value }: MetricTileProps) {
  const palette = useRiskPalette();

  return (
    <div
      style={{
        backgroundColor: palette.bgElevated,
        borderRadius: 12,
        display: 'flex',
        flexDirection: 'column',
        gap: px(designTokens.spacing.xs),
        padding: px(designTokens.spacing.md)
      }}
    >
      <span
        style={{
          color: palette.textSecondary,
          fontSize: px(designTokens.fontSize.sm),
          fontWeight: 600
        }}
      >
        {label}
      </span>
      <span
        style={{
          color: palette.textPrimary,
          fontSize: px(designTokens.fontSize.lg),
          fontWeight: 600
        }}
      >
        {value}
      </span>
      {children}
    </div>
  );
}

export interface EmptyStateProps {
  actionLabel?: string;
  message: string;
  onAction?: () => void;
  title?: string;
}

// An icon + short title + one-line helper + optional primary action,
// instead of a bare "No data" sentence - this is the state every Risk
// section is in right now (there is no portfolio data in the system yet),
// so it needs to look like a deliberate, finished part of the page.
export function EmptyState({
  actionLabel,
  message,
  onAction,
  title
}: EmptyStateProps) {
  const palette = useRiskPalette();

  return (
    <div
      style={{
        alignItems: 'center',
        display: 'flex',
        flexDirection: 'column',
        gap: px(designTokens.spacing.sm),
        padding: `${px(designTokens.spacing.lg)} ${px(designTokens.spacing.sm)}`,
        textAlign: 'center'
      }}
    >
      <EmptyStateIcon color={palette.textMuted} />
      {title ? (
        <p style={{ color: palette.textPrimary, fontWeight: 600, margin: 0 }}>
          {title}
        </p>
      ) : null}
      <p
        style={{
          color: palette.textMuted,
          margin: 0,
          maxWidth: 360
        }}
      >
        {message}
      </p>
      {actionLabel && onAction ? (
        <RiskButton onClick={onAction} variant="secondary">
          {actionLabel}
        </RiskButton>
      ) : null}
    </div>
  );
}

function EmptyStateIcon({ color }: { color: string }) {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height={40}
      viewBox="0 0 24 24"
      width={40}
    >
      <circle cx="12" cy="12" r="9" stroke={color} strokeWidth="1.5" />
      <path
        d="M12 8v5"
        stroke={color}
        strokeLinecap="round"
        strokeWidth="1.5"
      />
      <circle cx="12" cy="16" r="0.75" fill={color} />
    </svg>
  );
}

export interface ErrorStateProps {
  message: string;
  onRetry?: () => void;
}

export function ErrorState({ message, onRetry }: ErrorStateProps) {
  const palette = useRiskPalette();

  return (
    <div
      role="alert"
      style={{
        alignItems: 'center',
        display: 'flex',
        flexDirection: 'column',
        gap: px(designTokens.spacing.sm),
        padding: `${px(designTokens.spacing.lg)} ${px(designTokens.spacing.sm)}`,
        textAlign: 'center'
      }}
    >
      <ErrorStateIcon color={palette.statusRed} />
      <p style={{ color: palette.textPrimary, margin: 0 }}>{message}</p>
      {onRetry ? (
        <RiskButton onClick={onRetry} variant="secondary">
          Try again
        </RiskButton>
      ) : null}
    </div>
  );
}

function ErrorStateIcon({ color }: { color: string }) {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height={32}
      viewBox="0 0 24 24"
      width={32}
    >
      <path
        d="M12 3 2 21h20L12 3z"
        stroke={color}
        strokeLinejoin="round"
        strokeWidth="1.5"
      />
      <path
        d="M12 10v4"
        stroke={color}
        strokeLinecap="round"
        strokeWidth="1.5"
      />
      <circle cx="12" cy="17" r="0.75" fill={color} />
    </svg>
  );
}

export interface SkeletonProps {
  height?: number;
  width?: string;
}

// A shimmering placeholder block, for loading states - the spec asks for
// skeletons rather than a bare spinner/"Loading…" sentence. The CSS
// `@keyframes` for the shimmer is injected once via a <style> tag (no new
// stylesheet asset, no bundler/loader config to add) and respects
// prefers-reduced-motion.
let shimmerInjected = false;

function ensureShimmerKeyframes() {
  if (shimmerInjected || typeof document === 'undefined') {
    return;
  }

  shimmerInjected = true;

  const style = document.createElement('style');
  style.textContent = `
@keyframes riskSkeletonShimmer { 0% { opacity: 0.6; } 50% { opacity: 1; } 100% { opacity: 0.6; } }
@media (prefers-reduced-motion: reduce) {
  .riskSkeleton { animation: none !important; }
}
`;
  document.head.appendChild(style);
}

export function Skeleton({ height = 16, width = '100%' }: SkeletonProps) {
  const palette = useRiskPalette();

  ensureShimmerKeyframes();

  return (
    <div
      aria-hidden="true"
      className="riskSkeleton"
      style={{
        animation: 'riskSkeletonShimmer 1.5s ease-in-out infinite',
        backgroundColor: palette.bgElevated,
        borderRadius: 8,
        height,
        width
      }}
    />
  );
}

export interface LoadingSkeletonGroupProps {
  announceAs?: string;
  rows?: number;
}

// Several skeleton rows plus the sr-only "Loading…" announcement screen
// readers need (role="status"/aria-busy is set by the caller around this).
export function LoadingSkeletonGroup({
  announceAs = 'Loading…',
  rows = 3
}: LoadingSkeletonGroupProps) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: px(designTokens.spacing.sm)
      }}
    >
      <VisuallyHidden>{announceAs}</VisuallyHidden>
      {Array.from({ length: rows }, (_, index) => (
        <Skeleton height={20} key={index} />
      ))}
    </div>
  );
}
