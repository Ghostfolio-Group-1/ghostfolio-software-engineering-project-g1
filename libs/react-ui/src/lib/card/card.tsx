import type { ReactNode } from 'react';

import { useTheme } from '../theme/theme-provider';
import { designTokens, px } from '../tokens/design-tokens';

export interface CardProps {
  children?: ReactNode;
  title?: string;
}

export function Card({ children, title }: CardProps) {
  const theme = useTheme();

  return (
    <section
      style={{
        backgroundColor: theme.color.surface,
        border: `1px solid ${theme.color.border}`,
        borderRadius: px(designTokens.borderRadius.md),
        color: theme.color.text,
        padding: px(designTokens.spacing.md)
      }}
    >
      {title ? (
        <h2 style={{ fontSize: px(designTokens.fontSize.lg), margin: 0 }}>
          {title}
        </h2>
      ) : null}
      {children}
    </section>
  );
}
