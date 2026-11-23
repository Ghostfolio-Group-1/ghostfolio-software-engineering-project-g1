import type { CSSProperties } from 'react';

import type { Theme } from '../theme/theme';

// Primary #36cfcc is 1.92:1 on white, under the 3:1 minimum for a chart mark.
// #0d7377 is 5.62:1 on white. Dark surfaces already clear 3:1 with primary
// (9.77:1 on #121212), so they keep it.
export const LIGHT_CHART_MARK = '#0d7377';

export function chartMarkColor(theme: Theme): string {
  return theme.name === 'dark' ? theme.color.primary : LIGHT_CHART_MARK;
}

// apps/client/src/styles.scss sets `button:focus { outline: 0 }`, which
// removes the keyboard ring from these controls. An inline outline wins
// over that rule while the button is focused.
export function focusedControlOutline(
  theme: Theme,
  focused: boolean
): CSSProperties {
  if (!focused) {
    return {};
  }

  return {
    outline: `2px solid ${theme.color.text}`,
    outlineOffset: '2px'
  };
}
