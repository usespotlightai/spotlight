import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { PairTally } from '@/components/features/replays/PairTally';

const tallyOf = (container: HTMLElement) =>
  container.querySelector('[data-slot="pair-tally"]');

describe('PairTally', () => {
  it('counts the wins, losses and ties against what it was set beside, leading to it', () => {
    const { container } = render(
      <MemoryRouter>
        <PairTally
          tally={{ wins: 1, losses: 2, ties: 0 }}
          against="the search’s starting config"
          to="/replays/replay_seed"
        />
      </MemoryRouter>,
    );

    expect(tallyOf(container)).toHaveTextContent(
      'Side by side with the search’s starting config: 1 win, 2 losses, 0 ties',
    );
    expect(
      screen.getByRole('link', { name: 'the search’s starting config' }),
    ).toHaveAttribute('href', '/replays/replay_seed');
    expect(
      screen.getByText('1 win, 2 losses, 0 ties'),
    ).toHaveAccessibleDescription(
      /Loss: the search’s starting config’s is closer/,
    );
  });

  it('shows nothing until a task was judged side by side', () => {
    const none = render(<PairTally tally={null} against="the baseline" />);
    const empty = render(
      <PairTally
        tally={{ wins: 0, losses: 0, ties: 0 }}
        against="the baseline"
      />,
    );

    expect(tallyOf(none.container)).toBeNull();
    expect(tallyOf(empty.container)).toBeNull();
  });
});
