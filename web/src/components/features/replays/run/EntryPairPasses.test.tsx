import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { EntryPairPasses } from '@/components/features/replays/run/EntryPairPasses';
import type { EntryPair } from '@/lib/replay';

const pair = (over: Partial<EntryPair> = {}): EntryPair => ({
  state: 'judged',
  otherRunId: 'run_other',
  outcome: 'tie',
  model: 'm',
  unpaired: null,
  passes: [
    {
      ownShownFirst: true,
      outcome: 'win',
      reasons: [{ text: 'Stops on a 410.', ownHunks: ['a#1'], theirHunks: [] }],
    },
    {
      ownShownFirst: false,
      outcome: 'loss',
      reasons: [
        {
          text: 'Keeps later retries.',
          ownHunks: [],
          theirHunks: ['b#1', 'b#2'],
        },
      ],
    },
  ],
  ...over,
});

const showing = (shown: EntryPair) =>
  render(
    <MemoryRouter>
      <EntryPairPasses pair={shown} otherRunTo="/runs/run_other" />
    </MemoryRouter>,
  );

describe('EntryPairPasses', () => {
  it('shows both passes’ reasons, and says a tie came from the judge changing its mind with the order', () => {
    showing(pair());

    expect(
      document.querySelector('[data-slot="pair-outcome"]'),
    ).toHaveTextContent('Neither');
    expect(
      document.querySelector('[data-slot="passes-disagreed"]'),
    ).toBeInTheDocument();
    expect(
      within(screen.getByRole('list', { name: 'Both passes' }))
        .getAllByRole('listitem')
        .filter((each) => each.dataset.slot === 'pair-reason')
        .map((each) => each.textContent),
    ).toEqual([
      'Stops on a 410. · Cites 1 hunk of this change',
      'Keeps later retries. · Cites 2 hunks of the other',
    ]);
    expect(screen.getByRole('link', { name: 'The other run' })).toHaveAttribute(
      'href',
      '/runs/run_other',
    );
  });

  it('does not call a tie both passes agreed on a disagreement', () => {
    showing(
      pair({
        passes: pair().passes.map((each) => ({ ...each, outcome: 'tie' })),
      }),
    );

    expect(
      document.querySelector('[data-slot="passes-disagreed"]'),
    ).not.toBeInTheDocument();
  });

  it('says why a change was not judged side by side', () => {
    showing(
      pair({
        state: 'unpaired',
        outcome: null,
        unpaired: 'request-failed',
        passes: [],
      }),
    );

    expect(
      screen.getByText('Not judged side by side: judge request failed.'),
    ).toBeInTheDocument();
  });
});
