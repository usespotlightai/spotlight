import type { Unjudged } from '@replays/domain/value-objects/change-judgment';
import type { ModelSpent } from '@replays/domain/value-objects/model-spent.vo';
import type { PairOrder } from '@replays/domain/value-objects/pair-order';

export type PairWinner = 'run' | 'other' | 'tie';

export interface JudgedPass {
  readonly order: PairOrder;
  readonly winner: PairWinner;
  readonly reasons: readonly {
    readonly text: string;
    readonly runHunks: readonly string[];
    readonly otherHunks: readonly string[];
  }[];
}

export interface JudgedPair {
  readonly judged: true;
  readonly passes: readonly JudgedPass[];
  readonly model: string;
  readonly spent: ModelSpent;
}

export type PairJudgment = JudgedPair | Unjudged;
