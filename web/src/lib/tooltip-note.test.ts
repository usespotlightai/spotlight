import { describe, expect, it } from 'vitest';
import { tooltipText } from '@/lib/tooltip-note';

describe('tooltipText', () => {
  it('keeps a plain tooltip as it is', () => {
    expect(tooltipText('Likely range: 23–88%.')).toBe('Likely range: 23–88%.');
  });

  it('reads a laid-out tooltip as sentences, title first', () => {
    expect(
      tooltipText({
        title: 'Likely overfit',
        body: 'It gained on searched tasks, not on held-out tasks.',
        rows: [['Line allows', '2']],
      }),
    ).toBe(
      'Likely overfit. It gained on searched tasks, not on held-out tasks. Line allows: 2.',
    );
  });

  it('leaves out a title that the mark already names', () => {
    expect(
      tooltipText(
        { title: 'Over the regression limit', rows: [['Line allows', '2']] },
        'Over the regression limit',
      ),
    ).toBe('Line allows: 2.');
  });

  it('reads a list after its title', () => {
    expect(
      tooltipText({
        body: 'Held out after the search.',
        list: { title: 'Held-out tasks (2)', items: ['One', 'Two'] },
      }),
    ).toBe('Held out after the search. Held-out tasks (2): One, Two.');
  });
});
