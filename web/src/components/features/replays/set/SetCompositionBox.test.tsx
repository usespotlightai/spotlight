import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SetCompositionBox } from '@/components/features/replays/set/SetCompositionBox';
import type { SetComposition } from '@/lib/replay';

const COMPOSITION: SetComposition = {
  outcomes: [
    { outcome: 'accepted', count: 1 },
    { outcome: 'sent-back', count: 0 },
    { outcome: 'asked', count: 0 },
    { outcome: 'failed', count: 7 },
    { outcome: 'other', count: 0 },
  ],
  origins: [
    { origin: 'person', count: 5 },
    { origin: 'github', count: 3 },
  ],
  oldest: null,
  median: null,
  newest: null,
  balanceWarning: null,
};

const box = () =>
  screen.getByRole('region', { name: 'What the set is made of' });

describe('SetCompositionBox', () => {
  it('counts how the runs turned out in words, not by colour alone', () => {
    render(<SetCompositionBox composition={COMPOSITION} />);

    const outcomes = within(
      screen.getByRole('list', { name: 'How its runs turned out' }),
    ).getAllByRole('listitem');

    expect(outcomes.map((each) => each.textContent)).toEqual([
      'Accepted1',
      'Sent back0',
      'Asked a person0',
      'Failed7',
      'Other0',
    ]);
    expect(box().querySelector('[data-slot="outcome-bar"]')).toHaveAttribute(
      'aria-hidden',
      'true',
    );
  });

  it('counts where the tasks came from', () => {
    render(<SetCompositionBox composition={COMPOSITION} />);

    expect(
      within(screen.getByRole('list', { name: 'Where their tasks came from' }))
        .getAllByRole('listitem')
        .map((each) => each.textContent),
    ).toEqual(['A person 5', '· GitHub 3']);
  });

  it('warns when one outcome crowds the set, and only then', () => {
    const { rerender } = render(
      <SetCompositionBox composition={COMPOSITION} />,
    );

    expect(screen.queryByRole('note')).not.toBeInTheDocument();

    rerender(
      <SetCompositionBox
        composition={{
          ...COMPOSITION,
          balanceWarning: { dominant: 'failed', count: 7, entries: 8 },
        }}
      />,
    );

    expect(screen.getByRole('note')).toHaveTextContent(
      '7 of 8 runs failed, so the set says little about how other runs go.',
    );
  });

  it('says when the runs ended', () => {
    const at = new Date(Date.now() - 2 * 3_600_000).toISOString();

    render(
      <SetCompositionBox
        composition={{ ...COMPOSITION, oldest: at, median: at, newest: at }}
      />,
    );

    expect(box()).toHaveTextContent('Ended 2h ago');
  });
});
