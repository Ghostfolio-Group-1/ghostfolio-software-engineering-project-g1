import { renderToStaticMarkup } from 'react-dom/server';

import { TargetAllocationForm } from './target-allocation-form';
import type { TargetAllocationFormValues } from './target-allocation-form.model';
import { createEmptyTargetAllocationFormValues } from './target-allocation-form.model';

describe('TargetAllocationForm', () => {
  it('renders one row per value, each with a key and percentage field', () => {
    const values: TargetAllocationFormValues = {
      groupBy: 'assetClass',
      rows: [
        { key: 'EQUITY', percentage: '60' },
        { key: 'FIXED_INCOME', percentage: '40' }
      ]
    };

    const html = renderToStaticMarkup(
      <TargetAllocationForm
        onChange={() => {}}
        onSubmit={() => {}}
        values={values}
      />
    );

    // Each row's Key/Percentage aria-label must include the row number -
    // with 2+ rows (the normal case for a real target allocation), a
    // screen reader needs to tell rows apart, not announce "Key" twice
    // with no way to know which is which (Mon 11/23 usability pass).
    expect(html).toContain('aria-label="Key (row 1)"');
    expect(html).toContain('aria-label="Key (row 2)"');
    expect(html).toContain('aria-label="Percentage (row 1)"');
    expect(html).toContain('aria-label="Percentage (row 2)"');
    expect(html.match(/aria-label="Key \(row \d+\)"/g)).toHaveLength(2);
    expect(html).toContain('value="EQUITY"');
    expect(html).toContain('value="60"');
    expect(html).toContain('value="FIXED_INCOME"');
    expect(html).toContain('value="40"');
    expect(html).toContain('Save target allocation');
  });

  it('shows the row error when present', () => {
    const html = renderToStaticMarkup(
      <TargetAllocationForm
        errors={{ rows: 'Each key may only appear once.' }}
        onChange={() => {}}
        onSubmit={() => {}}
        values={createEmptyTargetAllocationFormValues()}
      />
    );

    expect(html).toContain('role="alert"');
    expect(html).toContain('Each key may only appear once.');
  });

  it('disables the submit button and shows "Saving…" while submitting', () => {
    const html = renderToStaticMarkup(
      <TargetAllocationForm
        isSubmitting
        onChange={() => {}}
        onSubmit={() => {}}
        values={createEmptyTargetAllocationFormValues()}
      />
    );

    expect(html).toContain('Saving…');
    expect(html).toMatch(/disabled(="")?[^>]*>Saving…/);
  });

  it('does not show a remove button for the only remaining row', () => {
    const html = renderToStaticMarkup(
      <TargetAllocationForm
        onChange={() => {}}
        onSubmit={() => {}}
        values={createEmptyTargetAllocationFormValues()}
      />
    );

    expect(html).not.toContain('Remove');
  });
});
