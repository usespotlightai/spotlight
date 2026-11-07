import type { UnjudgedJudgment } from '@insights/application/ports/change-judgments.port';
import type { PairOrder } from '@insights/domain/value-objects/pair-order';
import type { JudgeCriteria } from '@shared-kernel/domain/value-objects/judge-criteria.vo';
import type { ModelUsage } from '@shared-kernel/domain/value-objects/model-usage.vo';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';

export const PAIR_JUDGMENTS = Symbol('PAIR_JUDGMENTS');

export interface PairJudgmentOrder {
  readonly runId: RunId;
  readonly otherRunId: RunId;
  readonly reference: RunId;
  readonly criteria: JudgeCriteria;
  readonly orders: readonly PairOrder[];
}

export interface PairJudgmentPass {
  readonly order: PairOrder;
  readonly winner: 'run' | 'other' | 'tie';
  readonly reasons: readonly {
    readonly text: string;
    readonly runHunks: readonly string[];
    readonly otherHunks: readonly string[];
  }[];
}

export type PairJudgment =
  | {
      readonly judged: true;
      readonly passes: readonly PairJudgmentPass[];
      readonly model: string;
      readonly spent: ModelUsage;
    }
  | UnjudgedJudgment;

export interface PairJudgmentsPort {
  readonly available: boolean;

  judge(order: PairJudgmentOrder): Promise<PairJudgment>;
}
