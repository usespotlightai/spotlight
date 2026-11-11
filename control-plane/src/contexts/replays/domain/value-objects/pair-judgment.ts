import type { Unjudged } from '@replays/domain/value-objects/change-judgment';
import type { PairPass } from '@replays/domain/value-objects/entry-pairing.vo';

export interface JudgedPair {
  readonly judged: true;
  readonly passes: readonly PairPass[];
  readonly model: string;
}

export type PairJudgment = JudgedPair | Unjudged;
