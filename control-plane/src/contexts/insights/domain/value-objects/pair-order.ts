import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';

export const PAIR_ORDERS = ['run-first', 'other-first'] as const;

export type PairOrder = (typeof PAIR_ORDERS)[number];

export const PAIR_LABELS = ['A', 'B', 'tie'] as const;

export type PairLabel = (typeof PAIR_LABELS)[number];

export type PairWinner = 'run' | 'other' | 'tie';

const OFFSET = 0x811c9dc5;

const PRIME = 0x01000193;

const mixed = (hash: number): number => {
  let mixing = hash;
  mixing ^= mixing >>> 16;
  mixing = Math.imul(mixing, 0x85ebca6b);
  mixing ^= mixing >>> 13;
  mixing = Math.imul(mixing, 0xc2b2ae35);
  mixing ^= mixing >>> 16;
  return mixing >>> 0;
};

export const pairOrderOf = (run: RunId, other: RunId): PairOrder => {
  let hash = OFFSET;

  for (const char of `pair:${run.value}:${other.value}`) {
    hash ^= char.codePointAt(0) ?? 0;
    hash = Math.imul(hash, PRIME) >>> 0;
  }

  return (mixed(hash) & 1) === 0 ? 'run-first' : 'other-first';
};

export const oppositeOf = (order: PairOrder): PairOrder =>
  order === 'run-first' ? 'other-first' : 'run-first';

export const winnerOf = (order: PairOrder, label: PairLabel): PairWinner => {
  if (label === 'tie') {
    return 'tie';
  }

  return (label === 'A') === (order === 'run-first') ? 'run' : 'other';
};
