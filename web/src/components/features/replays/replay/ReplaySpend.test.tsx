import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ReplaySpend } from '@/components/features/replays/replay/ReplaySpend';
import { spendShown } from '@/lib/insights';
import type { ReplayDetail } from '@/lib/replay';

const replayWith = (totals: Partial<ReplayDetail['totals']>): ReplayDetail =>
  ({
    ceiling: { amount: 5, currency: 'USD' },
    entries: [],
    totals: {
      spent: { amount: 1.5, currency: 'USD' },
      spentElsewhere: [],
      unpriced: 0,
      unpricedCalls: 0,
      ...totals,
    },
  }) as unknown as ReplayDetail;

describe('ReplaySpend', () => {
  it('shows side-by-side judging as spent against the ceiling, not toward cost per run', () => {
    render(
      <ReplaySpend
        replay={
          {
            ...replayWith({}),
            entries: [
              {
                cost: null,
                draftingSpent: null,
                judgingSpent: null,
                pairingSpent: {
                  spends: [{ amount: 0.04, currency: 'USD' }],
                  unpriced: 0,
                },
              },
            ],
          } as unknown as ReplayDetail
        }
      />,
    );

    expect(screen.getByText('Side by side').parentElement).toHaveAttribute(
      'title',
      'Judging changes side by side counts against the ceiling, but not toward cost per run.',
    );
    expect(
      screen.getByText('Side by side').nextElementSibling,
    ).toHaveTextContent(spendShown({ amount: 0.04, currency: 'USD' }));
  });

  it('names what was spent in other currencies, outside the ceiling, and what nobody priced', () => {
    render(
      <ReplaySpend
        replay={replayWith({
          spentElsewhere: [{ amount: 2, currency: 'EUR' }],
          unpriced: 1,
          unpricedCalls: 3,
        })}
      />,
    );

    expect(screen.getByText('Also spent').parentElement).toHaveAttribute(
      'title',
      'Spent in another currency, so not counted against the ceiling',
    );
    expect(screen.getByText('Also spent').nextElementSibling).toHaveTextContent(
      spendShown({ amount: 2, currency: 'EUR' }),
    );
    expect(screen.getByText('1 run · 3 model calls')).toBeInTheDocument();
  });

  it('says honestly when runs already running took it over its ceiling', () => {
    render(
      <ReplaySpend
        replay={replayWith({ spent: { amount: 5.5, currency: 'USD' } })}
      />,
    );

    expect(
      screen.getByText(
        `Over the ceiling by ${spendShown({ amount: 0.5, currency: 'USD' })}`,
      ),
    ).toBeInTheDocument();
  });

  it('says nothing more when everything was priced in the ceiling’s currency', () => {
    render(<ReplaySpend replay={replayWith({})} />);

    expect(screen.queryByText(/Over the ceiling/)).toBeNull();

    expect(screen.queryByText('Also spent')).toBeNull();
    expect(screen.queryByText('Not priced')).toBeNull();
  });
});
