import type { Unjudged } from '@replays/domain/value-objects/change-judgment';
import type { PairPass } from '@replays/domain/value-objects/entry-pairing.vo';
import type { ModelSpent } from '@replays/domain/value-objects/model-spent.vo';

export interface JudgedPair {
  readonly judged: true;
  readonly passes: readonly PairPass[];
  readonly model: string;
  readonly spent: ModelSpent;
}

export type PairJudgment = JudgedPair | Unjudged;
