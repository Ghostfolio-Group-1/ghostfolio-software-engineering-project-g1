import { renderToStaticMarkup } from 'react-dom/server';

import { TargetAllocationEditor } from './target-allocation-editor';
import { createEmptyTargetAllocationFormValues } from './target-allocation-form.model';
import type { TargetAllocationBucket } from './target-allocation.client';

describe('TargetAllocationEditor', () => {
  it('shows the loading state', () => {
    const html = renderToStaticMarkup(
      <TargetAllocationEditor
        onChange={() => {}}
        onSubmit={() => {}}
        status="loading"
        values={createEmptyTargetAllocationFormValues()}
      />
    );

    expect(html).toContain('aria-busy="true"');
  });

  it('tells the user nothing is set yet, but still shows the form to create one', () => {
    const html = renderToStaticMarkup(
      <TargetAllocationEditor
        onChange={() => {}}
        onSubmit={() => {}}
        status="ready"
        values={createEmptyTargetAllocationFormValues()}
      />
    );

    expect(html).toContain('No target allocation configured yet.');
    expect(html).toContain('Save target allocation');
    expect(html).not.toContain('Clear target allocation');
  });

  it('shows the current buckets and a clear action when a target allocation is set', () => {
    const buckets: TargetAllocationBucket[] = [
      {
        actual: 0.55,
        deviation: -0.05,
        key: 'EQUITY',
        severity: 'YELLOW',
        target: 0.6
      }
    ];

    const html = renderToStaticMarkup(
      <TargetAllocationEditor
        buckets={buckets}
        isSet
        onChange={() => {}}
        onClear={() => {}}
        onSubmit={() => {}}
        status="ready"
        values={createEmptyTargetAllocationFormValues()}
      />
    );

    expect(html).not.toContain('No target allocation configured yet.');
    expect(html).toContain('55% actual');
    expect(html).toContain('60% target');
    expect(html).toContain('Clear target allocation');
  });

  it('shows a submit error distinct from the initial-load error', () => {
    const html = renderToStaticMarkup(
      <TargetAllocationEditor
        onChange={() => {}}
        onSubmit={() => {}}
        status="ready"
        submitErrorMessage="Target percentages must add up to 100%."
        values={createEmptyTargetAllocationFormValues()}
      />
    );

    expect(html).toContain('Target percentages must add up to 100%.');
  });
});
