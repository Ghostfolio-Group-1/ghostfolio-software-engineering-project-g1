import { designTokens, px } from '../tokens/design-tokens';

// Scoped to the Tax workspace so other Ghostfolio pages and shared React
// components are unaffected. Colors follow the existing React ThemeProvider.
// Keeping these as a string avoids introducing a new CSS import transform in
// the shared Jest configuration during Iteration 3.
export const taxWorkspaceStyles = `
  .gf-tax-workspace {
    box-sizing: border-box;
    color: var(--gf-tax-text);
    font-family: ${designTokens.fontFamily};
    margin-inline: auto;
    max-width: 1120px;
    padding: ${px(designTokens.spacing.sm)} ${px(designTokens.spacing.sm)} ${px(designTokens.spacing.xl)};
    width: 100%;
  }

  .gf-tax-workspace > h2 {
    font-size: ${px(designTokens.fontSize.xl)};
    font-weight: 600;
    line-height: 1.25;
    margin: 0 0 ${px(designTokens.spacing.lg)};
  }

  .gf-tax-workspace__tabs {
    border-bottom: 1px solid var(--gf-tax-border);
    display: grid;
    gap: ${px(designTokens.spacing.sm)};
    grid-template-columns: repeat(2, minmax(0, 1fr));
    margin-bottom: ${px(designTokens.spacing.lg)};
    max-width: 900px;
    padding-bottom: ${px(designTokens.spacing.md)};
  }

  .gf-tax-workspace__tab {
    background: var(--gf-tax-surface);
    border: 1px solid var(--gf-tax-border);
    border-radius: ${px(designTokens.borderRadius.md)};
    color: var(--gf-tax-text);
    cursor: pointer;
    font-family: inherit;
    font-size: ${px(designTokens.fontSize.sm)};
    line-height: 1.35;
    min-height: 40px;
    min-width: 0;
    padding: ${px(designTokens.spacing.sm)} ${px(designTokens.spacing.md)};
    text-align: center;
    transition: border-color 120ms ease, background-color 120ms ease;
    width: 100%;
  }

  .gf-tax-workspace__tab:hover {
    border-color: var(--gf-tax-primary);
  }

  .gf-tax-workspace__tab[aria-pressed='true'] {
    border-color: var(--gf-tax-primary);
    box-shadow: inset 0 -3px 0 var(--gf-tax-primary);
    font-weight: 600;
  }

  .gf-tax-workspace__view {
    min-width: 0;
  }

  .gf-tax-workspace label {
    color: var(--gf-tax-text);
    font-size: ${px(designTokens.fontSize.sm)};
    font-weight: 600;
    margin-right: ${px(designTokens.spacing.sm)};
  }

  /* Align form rows and the adjacent method selector without changing
     the API-owned screen components or their input behavior. */
  .gf-tax-workspace__view > section > label,
  .gf-tax-workspace__view > section > form > label,
  .gf-tax-workspace__view > div > p > label {
    display: inline-block;
    min-width: 170px;
    vertical-align: middle;
  }

  .gf-tax-workspace__view > section > form > label {
    margin-right: 0;
  }

  .gf-tax-workspace__view > section > select,
  .gf-tax-workspace__view > div > p > select {
    vertical-align: middle;
  }

  /* Give the result card breathing room below filters, in every Tax view. */
  .gf-tax-workspace__view > section > section,
  .gf-tax-workspace__view > section > div > section,
  .gf-tax-workspace__view > div > section {
    margin-top: ${px(designTokens.spacing.md)};
  }

  .gf-tax-workspace select,
  .gf-tax-workspace input {
    background-color: var(--gf-tax-surface);
    border: 1px solid var(--gf-tax-border);
    border-radius: ${px(designTokens.borderRadius.sm)};
    box-sizing: border-box;
    color: var(--gf-tax-text);
    font-family: inherit;
    font-size: ${px(designTokens.fontSize.sm)};
    min-height: 40px;
    max-width: 100%;
    padding: ${px(designTokens.spacing.sm)} ${px(designTokens.spacing.md)};
  }

  .gf-tax-workspace select {
    min-width: 150px;
  }

  .gf-tax-workspace input[type='number'] {
    width: 130px;
  }

  .gf-tax-workspace form {
    align-items: center;
    display: flex;
    flex-wrap: wrap;
    gap: ${px(designTokens.spacing.sm)};
    margin: 0 0 ${px(designTokens.spacing.md)};
  }

  .gf-tax-workspace form button {
    background: var(--gf-tax-primary);
    border: 1px solid var(--gf-tax-primary);
    border-radius: ${px(designTokens.borderRadius.sm)};
    color: #212121;
    cursor: pointer;
    font-family: inherit;
    font-size: ${px(designTokens.fontSize.sm)};
    font-weight: 600;
    min-height: 40px;
    padding: ${px(designTokens.spacing.sm)} ${px(designTokens.spacing.md)};
  }

  .gf-tax-workspace form button:disabled {
    cursor: not-allowed;
    opacity: 0.5;
  }

  .gf-tax-workspace :is(button, select, input):focus-visible {
    outline: 2px solid var(--gf-tax-primary);
    outline-offset: 2px;
  }

  .gf-tax-workspace__view p {
    line-height: 1.5;
  }

  @media (min-width: 1200px) {
    .gf-tax-workspace__tabs {
      grid-template-columns: repeat(4, minmax(0, 1fr));
    }
  }

  @media (max-width: 600px) {
    .gf-tax-workspace__tab {
      padding-inline: ${px(designTokens.spacing.sm)};
    }

    .gf-tax-workspace__view > section > label,
    .gf-tax-workspace__view > div > p > label {
      display: block;
      margin-bottom: ${px(designTokens.spacing.sm)};
      min-width: 0;
    }

    .gf-tax-workspace__view > section > select,
    .gf-tax-workspace__view > div > p > select {
      width: 100%;
    }

    .gf-tax-workspace form {
      align-items: stretch;
      flex-direction: column;
    }

    .gf-tax-workspace form label,
    .gf-tax-workspace form input,
    .gf-tax-workspace form button {
      width: 100%;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .gf-tax-workspace__tab {
      transition: none;
    }
  }
`;
