import type { ReactNode } from 'react';

import { useTheme } from '../theme/theme-provider';
import { designTokens, px } from '../tokens/design-tokens';

export interface ButtonProps {
  children?: ReactNode;
  disabled?: boolean;
  onClick?: () => void;
  variant?: 'primary' | 'secondary';
}

export function Button({
  children,
  disabled = false,
  onClick,
  variant = 'primary'
}: ButtonProps) {
  const theme = useTheme();
  const isPrimary = variant === 'primary';

  return (
    <button
      disabled={disabled}
      onClick={onClick}
      style={{
        backgroundColor: isPrimary ? theme.color.primary : 'transparent',
        border: `1px solid ${theme.color.primary}`,
        borderRadius: px(designTokens.borderRadius.sm),
        color: isPrimary ? theme.color.primaryText : theme.color.text,
        cursor: disabled ? 'not-allowed' : 'pointer',
        fontSize: px(designTokens.fontSize.md),
        opacity: disabled ? 0.5 : 1,
        padding: `${px(designTokens.spacing.sm)} ${px(designTokens.spacing.md)}`
      }}
      type="button"
    >
      {children}
    </button>
  );
}
