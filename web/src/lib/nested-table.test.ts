import { describe, expect, it } from 'vitest';
import { columnTemplate } from '@/lib/nested-table';

const HEADINGS = [
  { label: 'Setup', size: 'minmax(12rem,1fr)' },
  { label: 'Runs' },
];

describe('columnTemplate', () => {
  it('lets the flexible column fill the width', () => {
    expect(columnTemplate(HEADINGS, [], false)).toBe(
      'minmax(12rem,1fr) max-content',
    );
  });

  it('puts the chosen widths in place of the sizes', () => {
    expect(columnTemplate(HEADINGS, [null, 80], true)).toBe(
      'minmax(12rem,1fr) 80px max-content',
    );
  });

  it('fills the rest of the width once no column is flexible', () => {
    expect(columnTemplate(HEADINGS, [200, null], false)).toBe(
      '200px max-content minmax(0,1fr)',
    );
  });
});
