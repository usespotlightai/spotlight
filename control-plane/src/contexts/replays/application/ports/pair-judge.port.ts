import type { PairJudgment } from '@replays/domain/value-objects/pair-judgment';
import type { PairOrder } from '@replays/domain/value-objects/pair-order';
import type { JudgeCriteria } from '@shared-kernel/domain/value-objects/judge-criteria.vo';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';

export const PAIR_JUDGE = Symbol('REPLAYS_PAIR_JUDGE');

export interface PairJudgeOrder {
  readonly run: RunId;
  readonly other: RunId;
  readonly reference: RunId;
  readonly criteria: JudgeCriteria;
  readonly orders: readonly PairOrder[];
}

export interface PairJudgePort {
  readonly available: boolean;

  judge(order: PairJudgeOrder): Promise<PairJudgment>;
}
