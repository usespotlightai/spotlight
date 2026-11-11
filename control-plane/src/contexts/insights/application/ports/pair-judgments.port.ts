import type { UnjudgedJudgment } from '@insights/application/ports/change-judgments.port';
import type { JudgeCriteria } from '@shared-kernel/domain/value-objects/judge-criteria.vo';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';

export const PAIR_JUDGMENTS = Symbol('PAIR_JUDGMENTS');

const PAIR_JUDGMENT_ORDERS = ['run-first', 'other-first'] as const;

export type PairJudgmentOrderKind = (typeof PAIR_JUDGMENT_ORDERS)[number];

export interface PairJudgmentOrder {
  readonly runId: RunId;
  readonly otherRunId: RunId;
  readonly reference: RunId;
  readonly criteria: JudgeCriteria;
  readonly orders: readonly PairJudgmentOrderKind[];
}

export interface PairJudgmentPass {
  readonly order: PairJudgmentOrderKind;
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
    }
  | UnjudgedJudgment;

export interface PairJudgmentsPort {
  readonly available: boolean;

  judge(order: PairJudgmentOrder): Promise<PairJudgment>;
}
