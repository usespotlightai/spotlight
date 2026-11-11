export type PairOrder = 'run-first' | 'other-first';

export const PAIR_LABELS = ['A', 'B', 'tie'] as const;

export type PairLabel = (typeof PAIR_LABELS)[number];

export type PairWinner = 'run' | 'other' | 'tie';

export const winnerOf = (order: PairOrder, label: PairLabel): PairWinner => {
  if (label === 'tie') {
    return 'tie';
  }

  return (label === 'A') === (order === 'run-first') ? 'run' : 'other';
};
